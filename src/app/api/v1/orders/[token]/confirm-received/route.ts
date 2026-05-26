import { ok, fail } from "@/lib/api";
import { db, EscrowStatus, OrderStatus } from "@/lib/db";
import { releaseEscrowHold } from "@/lib/escrow";
import { notifyEscrowReleasedToShop } from "@/lib/push-notify";

interface Ctx {
  params: Promise<{ token: string }>;
}

/**
 * POST /api/v1/orders/:token/confirm-received — public; buyer-only.
 *
 * The buyer presses "ยืนยันได้รับสินค้า" on their tracking page and we
 * release the EscrowHold to the shop immediately (no need to wait the
 * 72h auto-release window).
 *
 * Gating:
 *   - Order must be DELIVERED (a buyer can't release before the shop says
 *     it shipped; this is also the legal status under our policy).
 *   - Order must have `useEscrow=true` (no hold otherwise; idempotent ok).
 *   - EscrowHold must be in HELD or DISPUTED status. DISPUTED implies the
 *     buyer is satisfied even though they opened a dispute earlier — we
 *     auto-close it via the same path. RELEASED/REFUNDED returns 200 with
 *     a `released:false, alreadyReleased:true` payload (idempotent).
 *
 * No auth — the publicToken IS the auth surface, same as every other
 * order endpoint. Anyone with the token can release; that's by design
 * since the token is shared with the buyer at checkout.
 */
export async function POST(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;

  const order = await db.order.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      status: true,
      useEscrow: true,
      escrowFeeSatang: true,
      publicToken: true,
      buyerConfirmedAt: true,
      shop: { select: { ownerId: true, name: true } },
      escrow: {
        select: {
          id: true,
          status: true,
          amountSatang: true,
        },
      },
    },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);

  if (!order.useEscrow) {
    return fail(
      "not_escrow_order",
      "ออเดอร์นี้ไม่ได้ใช้ Protected Pay",
      409,
    );
  }
  if (order.status !== OrderStatus.DELIVERED) {
    return fail(
      "not_delivered",
      "ต้องรอสถานะ 'จัดส่งสำเร็จ' ก่อนกดยืนยัน",
      409,
    );
  }
  if (!order.escrow) {
    // Shouldn't happen if useEscrow=true and PAID was reached, but handle it.
    return fail("no_hold", "ไม่พบเรคคอร์ดเอสโครว์", 409);
  }

  // Idempotent: if already released/refunded, return current state without error.
  if (order.escrow.status === EscrowStatus.RELEASED) {
    return ok({
      released: false,
      alreadyReleased: true,
      buyerConfirmedAt: order.buyerConfirmedAt,
    });
  }
  if (order.escrow.status === EscrowStatus.REFUNDED) {
    return fail(
      "already_refunded",
      "เงินถูกคืนให้ผู้ซื้อแล้ว — ไม่สามารถปล่อยให้ร้านได้",
      409,
    );
  }

  // Release the hold + stamp the buyer-confirm timestamp on the Order in
  // parallel. The push notification fires in the background.
  const result = await releaseEscrowHold({
    holdId: order.escrow.id,
    reason: "buyer_confirmed",
  });
  await db.order.update({
    where: { id: order.id },
    data: { buyerConfirmedAt: new Date() },
  });

  void notifyEscrowReleasedToShop({
    shopOwnerUserId: order.shop.ownerId,
    orderToken: order.publicToken,
    amountSatang: order.escrow.amountSatang,
    reason: "buyer_confirmed",
  }).catch(() => undefined);

  return ok({
    released: result.released,
    alreadyReleased: result.alreadyReleased,
  });
}
