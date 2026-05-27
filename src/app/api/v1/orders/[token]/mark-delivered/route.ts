import { ok, fail } from "@/lib/api";
import { db, OrderStatus, EscrowStatus } from "@/lib/db";
import { releaseEscrowHold } from "@/lib/escrow";
import { notifyEscrowReleasedToShop } from "@/lib/push-notify";

interface Ctx {
  params: Promise<{ token: string }>;
}

/**
 * POST /api/v1/orders/[token]/mark-delivered
 *
 * Buyer-initiated "ของถึงแล้ว — กดยืนยัน" closes the SHIPPING loop
 * without a courier API. 911korn 2026-05-27 "ระบบเรา Auto track เลข
 * Tracking นั้น แล้วเอามาอัพเดทสถานะออเดอร์เอง / จบ Loop เสมือนมี api
 * เองเลย" — the cheap version is buyer self-confirm + a 7-day cron
 * fallback (see /cron/auto-mark-delivered).
 *
 * Behavior:
 *   - SHIPPING → DELIVERED, stamps Shipment.deliveredAt
 *   - If Order.useEscrow: also stamps buyerConfirmedAt and releases
 *     the EscrowHold immediately (same effect as the existing
 *     /confirm-received endpoint, since flipping to DELIVERED + confirm
 *     in the same tap is what the buyer means).
 *   - Idempotent: already DELIVERED returns ok({ alreadyDelivered: true }).
 *
 * No auth — same publicToken-is-auth model as every other order
 * endpoint. The buyer holds the token.
 */
export async function POST(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;

  const order = await db.order.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      status: true,
      useEscrow: true,
      publicToken: true,
      buyerConfirmedAt: true,
      shop: { select: { ownerId: true, name: true } },
      shipment: { select: { id: true } },
      escrow: { select: { id: true, status: true, amountSatang: true } },
    },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);

  if (order.status === OrderStatus.DELIVERED) {
    return ok({ alreadyDelivered: true, buyerConfirmedAt: order.buyerConfirmedAt });
  }
  if (order.status !== OrderStatus.SHIPPING && order.status !== OrderStatus.PAID) {
    return fail(
      "wrong_status",
      "กดยืนยันรับของได้เฉพาะออเดอร์ที่กำลังจัดส่ง",
      409,
    );
  }

  const now = new Date();
  await db.$transaction([
    db.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.DELIVERED,
        buyerConfirmedAt: now,
      },
    }),
    ...(order.shipment
      ? [
          db.shipment.update({
            where: { id: order.shipment.id },
            data: { status: "DELIVERED", deliveredAt: now },
          }),
        ]
      : []),
  ]);

  // Escrow: instant release on buyer confirm. Mirrors /confirm-received.
  if (order.useEscrow && order.escrow && order.escrow.status === EscrowStatus.HELD) {
    try {
      await releaseEscrowHold({
        holdId: order.escrow.id,
        reason: "buyer_confirmed",
      });
      void notifyEscrowReleasedToShop({
        shopOwnerUserId: order.shop.ownerId,
        orderToken: order.publicToken,
        amountSatang: order.escrow.amountSatang,
        reason: "buyer_confirmed",
      }).catch(() => undefined);
    } catch (err) {
      console.error("Escrow release on mark-delivered failed:", err);
    }
  }

  return ok({ delivered: true });
}
