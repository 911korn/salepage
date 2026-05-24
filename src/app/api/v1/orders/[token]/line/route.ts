import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyPlatformLineIdToken } from "@/lib/line";
import { normalizeCustomerPhone } from "@/lib/customer-addresses";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ token: string }>;
}

const Body = z.object({
  idToken: z.string().min(20),
});

export async function POST(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  let profile: Awaited<ReturnType<typeof verifyPlatformLineIdToken>>;
  try {
    profile = await verifyPlatformLineIdToken(parsed.data.idToken);
  } catch (e) {
    return fail(
      "line_verify_failed",
      "ยืนยันตัวตน LINE ไม่สำเร็จ กรุณาลองใหม่",
      401,
      e instanceof Error ? e.message : "LINE verify failed",
    );
  }

  const order = await db.order.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      publicToken: true,
      status: true,
      shopId: true,
      customerPhone: true,
      customerLineUserId: true,
      shop: { select: { slug: true, name: true } },
    },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);

  if (order.customerLineUserId && order.customerLineUserId !== profile.sub) {
    return fail(
      "line_owner_mismatch",
      "ออเดอร์นี้ผูกกับ LINE อื่นแล้ว",
      409,
    );
  }

  const linkedAt = new Date();
  const lineData = {
    customerLineUserId: profile.sub,
    customerLineDisplayName: profile.name ?? null,
    customerLinePictureUrl: profile.picture ?? null,
    lineLinkedAt: linkedAt,
  };

  const updated = await db.order.update({
    where: { id: order.id },
    data: lineData,
    select: {
      publicToken: true,
      status: true,
      customerLineDisplayName: true,
      customerLinePictureUrl: true,
      shop: { select: { slug: true, name: true } },
    },
  });

  const phone = normalizeCustomerPhone(order.customerPhone);
  if (phone.length >= 9) {
    void db.order
      .updateMany({
        where: {
          shopId: order.shopId,
          customerPhone: phone,
          OR: [{ customerLineUserId: null }, { customerLineUserId: profile.sub }],
        },
        data: lineData,
      })
      .catch((e) => {
        console.warn("[line] bulk phone link failed:", e);
      });
  }

  return ok({
    linked: true,
    profile: {
      userId: profile.sub,
      displayName: profile.name ?? null,
      pictureUrl: profile.picture ?? null,
    },
    order: {
      token: updated.publicToken,
      status: updated.status,
      shop: updated.shop,
    },
  });
}
