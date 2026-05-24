import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyPlatformLineIdToken } from "@/lib/line";

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

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      customerLineUserId: profile.sub,
      customerLineDisplayName: profile.name ?? null,
      customerLinePictureUrl: profile.picture ?? null,
      lineLinkedAt: new Date(),
    },
    select: {
      publicToken: true,
      status: true,
      customerLineDisplayName: true,
      customerLinePictureUrl: true,
      shop: { select: { slug: true, name: true } },
    },
  });

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
