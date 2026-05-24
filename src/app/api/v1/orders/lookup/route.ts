import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeCustomerPhone } from "@/lib/customer-addresses";
import { buildOrderRef } from "@/lib/orders";

export const runtime = "nodejs";

const Body = z.object({
  phone: z.string().min(8).max(30),
  shopSlug: z.string().min(1).max(80).optional().nullable(),
});

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  const phone = normalizeCustomerPhone(parsed.data.phone);
  if (phone.length < 9) {
    return fail("invalid_phone", "กรุณากรอกเบอร์โทรให้ครบ", 422);
  }

  const phoneHint = phone.slice(-4);
  const shopSlug = parsed.data.shopSlug?.trim() || null;
  const candidates = await db.order.findMany({
    where: {
      customerPhone: { contains: phoneHint },
      ...(shopSlug
        ? {
            shop: {
              slug: shopSlug,
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      publicToken: true,
      status: true,
      items: true,
      totalSatang: true,
      trackingNumber: true,
      createdAt: true,
      customerPhone: true,
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

  const orders = candidates.filter(
    (order) => normalizeCustomerPhone(order.customerPhone) === phone,
  );

  return ok({
    phone,
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
