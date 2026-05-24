import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyPlatformLineIdToken } from "@/lib/line";
import { buildOrderRef } from "@/lib/orders";

export const runtime = "nodejs";

const Body = z.object({
  idToken: z.string().min(20),
  shopSlug: z.string().min(1).max(80).optional().nullable(),
});

export async function POST(request: Request) {
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

  const shopSlug = parsed.data.shopSlug?.trim() || null;
  const orders = await db.order.findMany({
    where: {
      customerLineUserId: profile.sub,
      ...(shopSlug
        ? {
            shop: {
              slug: shopSlug,
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      publicToken: true,
      status: true,
      items: true,
      totalSatang: true,
      trackingNumber: true,
      createdAt: true,
      shipment: {
        select: {
          courierName: true,
          serviceName: true,
          trackingNumber: true,
          status: true,
        },
      },
      shop: {
        select: {
          slug: true,
          name: true,
          logoText: true,
          logoUrl: true,
          themeColor: true,
        },
      },
    },
  });

  return ok({
    profile: {
      userId: profile.sub,
      displayName: profile.name ?? null,
      pictureUrl: profile.picture ?? null,
    },
    orders: orders.map((order) => ({
      token: order.publicToken,
      ref: buildOrderRef(order.createdAt, order.id),
      status: order.status,
      totalSatang: order.totalSatang,
      trackingNumber: order.shipment?.trackingNumber ?? order.trackingNumber,
      createdAt: order.createdAt,
      shop: order.shop,
      shipment: order.shipment,
      items: normalizeItems(order.items),
    })),
  });
}

function normalizeItems(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      return {
        name: String(record.productName ?? record.name ?? "สินค้า"),
        qty: Number(record.qty ?? 1),
        image: typeof record.image === "string" ? record.image : null,
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}
