import { ok, fail } from "@/lib/api";
import { db, DisputeStatus, OrderStatus } from "@/lib/db";
import {
  pushToUser,
  resolveCustomerUserId,
  notifyEscrowRefundedToBuyer,
} from "@/lib/push-notify";
import { recomputeTrustScore } from "@/lib/trust-score";
import { refundEscrowHold } from "@/lib/escrow";

/**
 * GET /api/v1/cron/auto-resolve-disputes
 *
 * SLA enforcer. If a dispute has been in `AWAITING_SHOP_RESPONSE` for more
 * than 72h with no shop counter-action, we auto-resolve in the buyer's
 * favor (RESOLVED_REFUND) and:
 *
 *   1. Flip the order to CANCELLED so loyalty/affiliate don't accrue.
 *   2. Recompute the shop's trust score.
 *   3. Push the buyer + shop owner.
 *
 * `OPEN` disputes are NOT auto-resolved — they're waiting on admin triage,
 * not on the shop. Only the explicit "request_shop_response" action starts
 * the SLA clock.
 *
 * Schedule (vercel.json): every 30 minutes — fast enough that stale
 * disputes don't linger, slow enough to avoid hammering the DB.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const SLA_MS = 72 * 60 * 60 * 1000;

export async function GET(request: Request) {
  if (!authorized(request)) {
    return fail("unauthorized", "Cron auth required", 401);
  }

  const cutoff = new Date(Date.now() - SLA_MS);

  // We use `updatedAt` (not createdAt) so the timer resets if admin
  // re-engages the shop with another `request_shop_response` action.
  const stale = await db.dispute.findMany({
    where: {
      status: DisputeStatus.AWAITING_SHOP_RESPONSE,
      updatedAt: { lt: cutoff },
    },
    take: 50, // Cap per-run so a backlog doesn't blow Vercel's 60s budget.
    select: {
      id: true,
      reason: true,
      order: {
        select: {
          id: true,
          status: true,
          publicToken: true,
          customerLineUserId: true,
          customerEmail: true,
          useEscrow: true,
          escrow: { select: { id: true, status: true, amountSatang: true } },
          shop: {
            select: { id: true, slug: true, name: true, ownerId: true },
          },
        },
      },
    },
  });

  let resolvedCount = 0;
  for (const d of stale) {
    try {
      await db.$transaction(async (tx) => {
        await tx.dispute.update({
          where: { id: d.id },
          data: {
            status: DisputeStatus.RESOLVED_REFUND,
            resolution:
              "Auto-resolved: ร้านไม่ตอบกลับใน 72 ชั่วโมง ระบบตัดสินคืนเงินอัตโนมัติ",
            resolvedAt: new Date(),
            // resolvedByUserId stays null — auto-resolution distinguishes
            // itself from admin-triggered closes by this absence.
          },
        });
        if (d.order.status !== OrderStatus.CANCELLED) {
          await tx.order.update({
            where: { id: d.order.id },
            data: {
              status: OrderStatus.CANCELLED,
              cancelledAt: new Date(),
              cancelledBy: "SYSTEM",
              cancelReason: "dispute-auto-resolved",
            },
          });
        }
      });

      void recomputeTrustScore(d.order.shop.id).catch(() => undefined);

      // V1.5 Protected Pay: refund the buyer's escrow on auto-resolution.
      // We do this outside the tx so a slow provider call doesn't lock the
      // dispute row — the EscrowHold has its own row, and `refundEscrowHold`
      // is idempotent.
      if (d.order.useEscrow && d.order.escrow) {
        const hold = d.order.escrow;
        void refundEscrowHold({ holdId: hold.id, reason: "dispute_refund" })
          .then((res) => {
            if (!res.refunded) return;
            return resolveCustomerUserId({
              customerLineUserId: d.order.customerLineUserId,
              customerEmail: d.order.customerEmail,
            }).then((buyerUserId) =>
              notifyEscrowRefundedToBuyer({
                customerUserId: buyerUserId,
                orderToken: d.order.publicToken,
                amountSatang: hold.amountSatang,
                reason: "dispute_refund",
              }),
            );
          })
          .catch((e) =>
            console.warn(
              `[cron/auto-resolve-disputes] escrow refund for ${d.id} failed:`,
              e,
            ),
          );
      }

      void resolveCustomerUserId({
        customerLineUserId: d.order.customerLineUserId,
        customerEmail: d.order.customerEmail,
      })
        .then((buyerUserId) => {
          if (!buyerUserId) return;
          return pushToUser(buyerUserId, {
            title: "✅ ข้อพิพาทถูกตัดสินคืนเงินอัตโนมัติ",
            body: `${d.order.shop.name} ไม่ตอบกลับใน 72 ชั่วโมง — ระบบคืนเงินให้คุณแล้ว`,
            data: {
              kind: "dispute.auto_resolved",
              disputeId: d.id,
              orderToken: d.order.publicToken,
            },
          });
        })
        .catch(() => undefined);

      void pushToUser(d.order.shop.ownerId, {
        title: "⚠️ ข้อพิพาทถูกคืนเงินอัตโนมัติ",
        body: `ออเดอร์ #${d.order.publicToken.slice(0, 8)} ไม่ตอบกลับใน 72 ชั่วโมง — Trust Score ปรับลง`,
        data: {
          kind: "dispute.auto_resolved",
          disputeId: d.id,
          orderToken: d.order.publicToken,
        },
      }).catch(() => undefined);

      resolvedCount++;
    } catch (error) {
      // One failed dispute shouldn't poison the whole run. Log + continue.
      console.error(`auto-resolve-disputes: failed dispute ${d.id}`, error);
    }
  }

  return ok({
    scanned: stale.length,
    resolved: resolvedCount,
    timestamp: new Date().toISOString(),
  });
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (request.headers.has("x-vercel-cron-signature")) return true;
  return false;
}
