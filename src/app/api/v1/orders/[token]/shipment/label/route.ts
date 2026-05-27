import { fail } from "@/lib/api";
import { db } from "@/lib/db";
import { buildOrderRef } from "@/lib/orders";
import { renderShippingLabelHtml } from "@/lib/shipping-label-html";

/**
 * GET /api/v1/orders/[token]/shipment/label
 *
 * Printable HTML label, **gated by the order's publicToken** (not by a
 * seller session). Same security model as `/o/[token]` — possession of
 * the 32-char token IS the authorisation. This lets mobile sellers open
 * the label in Safari/Chrome via Linking.openURL without round-tripping
 * a session cookie.
 *
 * Stamps `labelGeneratedAt` on first fetch so the dashboard can show
 * "พิมพ์ใบปะหน้าแล้ว · รอ tracking" badges on order rows. Idempotent —
 * doesn't re-stamp if already set, so timestamp truly reflects first-print.
 *
 * Returns text/html (not JSON) — seller's browser opens it inline and
 * the embedded "พิมพ์" button triggers `window.print()`. 911korn 2026-05-27.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: {
      shop: {
        select: { id: true, name: true, ownerId: true, contact: true },
      },
    },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);
  // Allow PAID + SHIPPING + DELIVERED so sellers can re-print a damaged
  // label or pull up a record for a completed shipment. Pending orders
  // can't print yet — money hasn't landed.
  if (
    order.status !== "PAID" &&
    order.status !== "SHIPPING" &&
    order.status !== "DELIVERED"
  ) {
    return fail(
      "wrong_status",
      "พิมพ์ใบปะหน้าได้เฉพาะออเดอร์ที่ลูกค้าชำระเงินแล้ว",
      409,
    );
  }

  if (!order.labelGeneratedAt) {
    await db.order.update({
      where: { id: order.id },
      data: { labelGeneratedAt: new Date() },
    });
  }

  const contact =
    order.shop.contact &&
    typeof order.shop.contact === "object" &&
    !Array.isArray(order.shop.contact)
      ? (order.shop.contact as {
          phone?: string;
          address?: string;
        })
      : null;

  const items = order.items as Array<{
    productName: string;
    qty: number;
  }>;

  const siteBase =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://salepage.in.th";

  const html = await renderShippingLabelHtml({
    orderRef: buildOrderRef(order.createdAt, order.id),
    publicToken: order.publicToken,
    trackingUrl: `${siteBase}/o/${order.publicToken}`,
    shop: {
      name: order.shop.name,
      senderName: order.shop.name,
      senderPhone: contact?.phone ?? null,
      senderAddress: contact?.address ?? null,
    },
    receiver: {
      name: order.customerName,
      phone: order.customerPhone,
      address: order.customerAddress,
    },
    items: items.map((it) => ({ name: it.productName, qty: it.qty })),
    shippingFeeSatang: order.shippingSatang,
    totalSatang: order.totalSatang,
    notes: order.notes,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
