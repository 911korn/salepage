import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, OrderStatus } from "@/lib/db";
import { sendOrderShipped } from "@/lib/email";
import { applyPaidOrderInventory, buildOrderRef } from "@/lib/orders";
import { notifyLineOrderUpdate } from "@/lib/line-order-notifications";
import {
  notifyOrderPaid,
  notifyOrderShipping,
  notifyOrderDelivered,
  resolveCustomerUserId,
} from "@/lib/push-notify";
import {
  createEscrowHoldOnPaid,
  markEscrowDelivered,
  refundEscrowHold,
} from "@/lib/escrow";

interface Ctx {
  params: Promise<{ token: string }>;
}

/**
 * PATCH /api/v1/orders/:token/status — shop owner only.
 *
 * Allowed transitions (we enforce them server-side to avoid the UI letting
 * the owner accidentally walk backwards from DELIVERED to PENDING, etc.):
 *   PENDING    → PAID | CANCELLED
 *   PAID       → SHIPPING | CANCELLED
 *   SHIPPING   → DELIVERED | CANCELLED
 *   DELIVERED  → (terminal)
 *   CANCELLED  → (terminal)
 *   REFUNDED   → (terminal)
 *
 * Token is the order's `publicToken` (same identifier the customer uses) so
 * the dashboard can deep-link without exposing internal Order.id.
 */
const Body = z.object({
  status: z
    .enum(["PAID", "SHIPPING", "DELIVERED", "CANCELLED", "REFUNDED"])
    .optional(),
  trackingNumber: z.string().max(60).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const ALLOWED_NEXT: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPING, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPING]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { token } = await ctx.params;
  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: { shop: { select: { id: true, ownerId: true } } },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);
  if (order.shop.ownerId !== session.user.id) {
    return fail("forbidden", "ไม่มีสิทธิ์", 403);
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { status, trackingNumber, notes } = parsed.data;

  const data: Record<string, unknown> = {};
  if (status !== undefined) {
    const allowed = ALLOWED_NEXT[order.status];
    if (!allowed.includes(status as OrderStatus)) {
      return fail(
        "invalid_transition",
        `สถานะ ${order.status} เปลี่ยนเป็น ${status} ไม่ได้`,
        409,
      );
    }
    data.status = status;
    // Stamp cancel metadata when the seller transitions to CANCELLED so
    // /me/orders' restore logic can tell BUYER-cancelled rows apart from
    // SELLER-rejected rows (only the former are restoreable).
    if (status === "CANCELLED") {
      data.cancelledAt = new Date();
      data.cancelledBy = "SELLER";
    }
  }
  if (trackingNumber !== undefined) data.trackingNumber = trackingNumber;
  if (notes !== undefined) data.notes = notes;

  const updated = await db.order.update({
    where: { id: order.id },
    data,
    include: { shop: { select: { name: true, slug: true, contact: true } } },
  });

  if (status !== undefined || trackingNumber !== undefined) {
    void notifyLineOrderUpdate(updated);
  }

  // Fire push notifications based on terminal status changes (fire-and-forget).
  // We resolve the customer User once and dispatch the matching trigger.
  if (status !== undefined && status !== order.status) {
    void resolveCustomerUserId({
      customerLineUserId: updated.customerLineUserId,
      customerEmail: updated.customerEmail,
    }).then((customerUserId) => {
      if (status === "PAID") {
        return notifyOrderPaid({
          customerUserId,
          orderToken: updated.publicToken,
          shopName: updated.shop.name,
          totalSatang: updated.totalSatang,
        });
      }
      if (status === "SHIPPING") {
        return notifyOrderShipping({
          customerUserId,
          orderToken: updated.publicToken,
          shopName: updated.shop.name,
          courierName: "พัสดุ",
          trackingNumber: updated.trackingNumber ?? "",
        });
      }
      if (status === "DELIVERED") {
        return notifyOrderDelivered({
          customerUserId,
          orderToken: updated.publicToken,
          shopName: updated.shop.name,
        });
      }
      return undefined;
    });
  }

  if (trackingNumber !== undefined || status === "DELIVERED" || status === "CANCELLED") {
    await db.shipment
      .update({
        where: { orderId: order.id },
        data: {
          ...(trackingNumber !== undefined ? { trackingNumber } : {}),
          ...(status === "DELIVERED"
            ? { status: "DELIVERED", deliveredAt: new Date() }
            : {}),
          ...(status === "CANCELLED" ? { status: "CANCELLED" } : {}),
        },
      })
      .catch(() => {});
  }

  // Award loyalty points on the first transition into PAID (only once — guard
  // by checking we transitioned FROM PENDING). 1 point per Shop.loyaltyBahtPerPoint THB spent.
  if (status === "PAID" && order.status === OrderStatus.PENDING) {
    await applyPaidOrderInventory(order);

    // V1.5 Protected Pay: same hold-creation as the auto slip-verify path.
    // Seller-side manual mark-paid is rare (skipped slip upload entirely)
    // but the buyer's escrow opt-in still applies.
    if (order.useEscrow) {
      try {
        await createEscrowHoldOnPaid({
          orderId: order.id,
          amountSatang: order.subtotalSatang + order.shippingSatang,
          feeSatang: order.escrowFeeSatang,
        });
      } catch (e) {
        console.warn("[escrow] createEscrowHoldOnPaid failed:", e);
      }
    }
  }

  // V1.5 Protected Pay: start the 72h auto-release clock when DELIVERED first
  // fires. We pass `new Date()` (not the Shipment.deliveredAt) so the timer
  // begins at the actual seller action, regardless of any backdated marking.
  if (status === "DELIVERED" && order.status !== OrderStatus.DELIVERED) {
    if (order.useEscrow) {
      try {
        await markEscrowDelivered(order.id, new Date());
      } catch (e) {
        console.warn("[escrow] markEscrowDelivered failed:", e);
      }
    }
  }

  // V1.5 Protected Pay: refund the buyer if the seller cancels a PAID order
  // (e.g. discovered out-of-stock). REFUNDED state is treated the same.
  if (
    (status === "CANCELLED" || status === "REFUNDED") &&
    order.useEscrow &&
    order.status !== OrderStatus.PENDING
  ) {
    try {
      const existingHold = await db.escrowHold.findUnique({
        where: { orderId: order.id },
        select: { id: true },
      });
      if (existingHold) {
        await refundEscrowHold({
          holdId: existingHold.id,
          reason: "admin_refund",
        });
      }
    } catch (e) {
      console.warn("[escrow] refundEscrowHold on cancel failed:", e);
    }
  }

  if (status === "PAID" && order.status === OrderStatus.PENDING && updated.customerPhone) {
    const cleanPhone = updated.customerPhone.replace(/[^\d]/g, "");
    if (cleanPhone.length >= 9) {
      const shopConfig = await db.shop.findUnique({
        where: { id: order.shop.id },
        select: { loyaltyBahtPerPoint: true },
      });
      const bahtPerPoint = shopConfig?.loyaltyBahtPerPoint ?? 100;
      if (bahtPerPoint > 0) {
        const totalBaht = Math.floor(updated.totalSatang / 100);
        const points = Math.floor(totalBaht / bahtPerPoint);
        if (points > 0) {
          await db.customerLoyalty.upsert({
            where: {
              shopId_customerPhone: {
                shopId: order.shop.id,
                customerPhone: cleanPhone,
              },
            },
            create: {
              shopId: order.shop.id,
              customerPhone: cleanPhone,
              customerName: updated.customerName,
              points,
              totalSpentSatang: updated.totalSatang,
            },
            update: {
              points: { increment: points },
              totalSpentSatang: { increment: updated.totalSatang },
              customerName: updated.customerName,
            },
          });
          await db.order.update({
            where: { id: order.id },
            data: { pointsEarned: points },
          });
        }
      }
    }
  }

  // Fire shipping notification email when transitioning to SHIPPING
  if (status === "SHIPPING" && updated.customerEmail) {
    const items = updated.items as Array<{
      productName: string;
      qty: number;
      priceSatang: number;
    }>;
    void sendOrderShipped({
      ref: buildOrderRef(updated.createdAt, updated.id),
      token: updated.publicToken,
      customerName: updated.customerName,
      customerEmail: updated.customerEmail,
      totalSatang: updated.totalSatang,
      items,
      shopName: updated.shop.name,
      shopContactEmail:
        (updated.shop.contact as { email?: string } | null)?.email ?? null,
      trackingNumber: updated.trackingNumber,
    });
  }

  return ok({ order: updated });
}
