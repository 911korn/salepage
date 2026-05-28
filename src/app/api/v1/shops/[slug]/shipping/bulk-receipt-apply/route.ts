import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, OrderStatus } from "@/lib/db";
import { hasBusinessPlan } from "@/lib/plan";
import { buildOrderRef } from "@/lib/orders";
import { sendOrderShipped } from "@/lib/email";
import { notifyLineOrderUpdate } from "@/lib/line-order-notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/v1/shops/[slug]/shipping/bulk-receipt-apply
 *
 * Second step of the bulk-tracking flow. After /bulk-receipt-scan
 * returned the seller's confirmed assignments, this endpoint actually
 * binds each tracking number to its order, flips PAID → SHIPPING,
 * and fires the buyer-facing notifications.
 *
 * Idempotent: any apply where the order already has a non-null
 * trackingNumber is skipped (with a `reason: "already_set"` in the
 * response) instead of overwriting. The seller can re-run the flow
 * after fixing one or two assignments without re-touching the others.
 */

const ApplySchema = z.object({
  orderId: z.string().min(1),
  trackingNumber: z.string().min(3).max(64),
  courier: z
    .enum([
      "FLASH",
      "KERRY",
      "JT",
      "THAIPOST",
      "SCG",
      "BEST",
      "NINJAVAN",
      "DHL",
      "OTHER",
    ])
    .nullable(),
});

const Body = z.object({
  applies: z.array(ApplySchema).min(1).max(200),
});

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, slug: true, ownerId: true, name: true, contact: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้าน", 404);
  if (shop.ownerId !== session.user.id) {
    return fail("forbidden", "ไม่ใช่เจ้าของร้านนี้", 403);
  }
  if (!(await hasBusinessPlan(session.user.id))) {
    return fail(
      "upgrade_required",
      "AI Bulk Tracking ใช้ได้กับแผน Business ขึ้นไป",
      402,
    );
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { applies } = parsed.data;

  // Reject mixed-shop attacks: every orderId must belong to THIS shop.
  // Cheaper to fetch all then filter than to fail per-row.
  const orders = await db.order.findMany({
    where: {
      id: { in: applies.map((a) => a.orderId) },
      shopId: shop.id,
    },
    select: {
      id: true,
      publicToken: true,
      status: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      customerLineUserId: true,
      customerAddress: true,
      totalSatang: true,
      items: true,
      trackingNumber: true,
      createdAt: true,
      shopId: true,
    },
  });
  const ordersById = new Map(orders.map((o) => [o.id, o]));

  // Reject if any tracking number in this batch is already assigned to
  // a DIFFERENT order in this shop. Prevents double-binding.
  const trackingNumbers = applies.map((a) => a.trackingNumber);
  const collisions = await db.order.findMany({
    where: {
      shopId: shop.id,
      trackingNumber: { in: trackingNumbers },
    },
    select: { id: true, trackingNumber: true },
  });
  const collisionMap = new Map(
    collisions.map((c) => [c.trackingNumber!, c.id]),
  );

  const applied: Array<{ orderId: string; trackingNumber: string }> = [];
  const skipped: Array<{
    orderId: string;
    trackingNumber: string;
    reason:
      | "order_not_in_shop"
      | "already_set"
      | "wrong_status"
      | "tracking_collision";
  }> = [];

  const now = new Date();
  for (const a of applies) {
    const order = ordersById.get(a.orderId);
    if (!order) {
      skipped.push({ ...a, reason: "order_not_in_shop" });
      continue;
    }
    if (order.trackingNumber) {
      skipped.push({ ...a, reason: "already_set" });
      continue;
    }
    if (
      order.status !== OrderStatus.PAID &&
      order.status !== OrderStatus.SHIPPING
    ) {
      skipped.push({ ...a, reason: "wrong_status" });
      continue;
    }
    const collisionOrderId = collisionMap.get(a.trackingNumber);
    if (collisionOrderId && collisionOrderId !== a.orderId) {
      skipped.push({ ...a, reason: "tracking_collision" });
      continue;
    }

    try {
      await db.$transaction([
        db.order.update({
          where: { id: order.id },
          data: {
            trackingNumber: a.trackingNumber,
            shippingReceiptScannedAt: now,
            ...(order.status === OrderStatus.PAID
              ? { status: OrderStatus.SHIPPING }
              : {}),
          },
        }),
        db.shipment.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            shopId: shop.id,
            provider: "self-dropoff",
            courierCode: a.courier ?? "OTHER",
            courierName: a.courier ?? "อื่นๆ",
            handoff: "DROPOFF",
            status: "IN_TRANSIT",
            trackingNumber: a.trackingNumber,
            receiverName: order.customerName,
            receiverPhone: order.customerPhone,
            receiverAddress: order.customerAddress,
            bookedAt: now,
            shippedAt: now,
          },
          update: {
            provider: "self-dropoff",
            courierCode: a.courier ?? "OTHER",
            courierName: a.courier ?? "อื่นๆ",
            trackingNumber: a.trackingNumber,
            status: "IN_TRANSIT",
            shippedAt: now,
          },
        }),
      ]);

      applied.push({ orderId: order.id, trackingNumber: a.trackingNumber });

      // Fire buyer notifications non-blocking — failure here shouldn't
      // block the whole batch from completing.
      const ref = buildOrderRef(order.createdAt, order.id);
      void sendOrderShipped({
        ref,
        token: order.publicToken,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        totalSatang: order.totalSatang,
        items: (order.items as never) ?? [],
        shopName: shop.name,
        shopContactEmail:
          (shop.contact as { email?: string } | null)?.email ?? null,
        trackingNumber: a.trackingNumber,
      });
      void notifyLineOrderUpdate({
        ...order,
        status: OrderStatus.SHIPPING,
        trackingNumber: a.trackingNumber,
        shop: { name: shop.name, slug: shop.slug },
      });
    } catch (err) {
      console.error("[bulk-apply] failed for order", order.id, err);
      skipped.push({ ...a, reason: "wrong_status" });
    }
  }

  return ok({ applied, skipped });
}
