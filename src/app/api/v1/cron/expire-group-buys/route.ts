import { ok, fail } from "@/lib/api";
import { db, GroupBuyStatus, OrderStatus } from "@/lib/db";
import { pushToUser, resolveCustomerUserId } from "@/lib/push-notify";
import { refundEscrowHold } from "@/lib/escrow";

/**
 * GET /api/v1/cron/expire-group-buys
 *
 * Two sweeps in one cron run:
 *
 *   1. EXPIRE — any ACTIVE campaign whose `deadline` has passed without
 *      hitting `minQty` is flipped to EXPIRED. All member orders are
 *      CANCELLED + (if escrow-protected) refunded. Buyers get a push.
 *
 *   2. CANCELLED follow-up — admin/owner CANCELLED campaigns also need
 *      their member orders cleaned up. Same code path as EXPIRE.
 *
 * We do NOT touch FILLED campaigns — those member orders are real, the
 * shop will fulfill them normally.
 *
 * Schedule: every 10 minutes (vercel.json) — small enough latency that
 * buyers see the auto-refund pretty quickly.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const PER_RUN_CAP = 50;

export async function GET(request: Request) {
  if (!authorized(request)) {
    return fail("unauthorized", "Cron auth required", 401);
  }

  const now = new Date();

  // Phase 1: flip past-deadline ACTIVE campaigns to EXPIRED.
  // updateMany returns count — we then re-fetch the affected rows for the
  // member-order sweep (cheaper than joining in one big update).
  const expiredFlip = await db.groupBuy.updateMany({
    where: {
      status: GroupBuyStatus.ACTIVE,
      deadline: { lte: now },
    },
    data: {
      status: GroupBuyStatus.EXPIRED,
      expiredAt: now,
    },
  });

  // Phase 2: find all EXPIRED + CANCELLED campaigns whose members still
  // have non-terminal orders, sweep them.
  const targets = await db.groupBuy.findMany({
    where: {
      status: { in: [GroupBuyStatus.EXPIRED, GroupBuyStatus.CANCELLED] },
      members: {
        some: {
          order: {
            status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
          },
        },
      },
    },
    take: PER_RUN_CAP,
    select: {
      id: true,
      status: true,
      title: true,
      product: { select: { name: true } },
      members: {
        where: {
          order: {
            status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
          },
        },
        select: {
          orderId: true,
          order: {
            select: {
              id: true,
              publicToken: true,
              status: true,
              useEscrow: true,
              customerLineUserId: true,
              customerEmail: true,
              escrow: { select: { id: true, status: true } },
            },
          },
        },
      },
    },
  });

  let refundedOrders = 0;
  for (const t of targets) {
    for (const m of t.members) {
      try {
        // Cancel the order (idempotent — updateMany with status filter).
        const cancelRes = await db.order.updateMany({
          where: {
            id: m.orderId,
            status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
          },
          data: { status: OrderStatus.CANCELLED },
        });
        if (cancelRes.count === 0) continue;

        // Refund escrow if it was protected and is HELD/DISPUTED.
        if (
          m.order.useEscrow &&
          m.order.escrow &&
          (m.order.escrow.status === "HELD" ||
            m.order.escrow.status === "DISPUTED")
        ) {
          await refundEscrowHold({
            holdId: m.order.escrow.id,
            reason: "admin_refund",
          }).catch(() => undefined);
        }

        // Push to buyer.
        void resolveCustomerUserId({
          customerLineUserId: m.order.customerLineUserId,
          customerEmail: m.order.customerEmail,
        })
          .then((userId) => {
            if (!userId) return;
            return pushToUser(userId, {
              title:
                t.status === GroupBuyStatus.EXPIRED
                  ? "Group Buy ไม่เต็ม — ยกเลิกอัตโนมัติ"
                  : "Group Buy ถูกยกเลิก",
              body: `${t.product.name} — เงินจะกลับเข้าบัญชี 1–3 วันทำการ`,
              data: {
                kind: "groupbuy.refunded",
                groupBuyId: t.id,
                orderToken: m.order.publicToken,
              },
            });
          })
          .catch(() => undefined);

        refundedOrders++;
      } catch (e) {
        console.warn(`[cron/expire-group-buys] order ${m.orderId} failed:`, e);
      }
    }
  }

  return ok({
    expiredCampaigns: expiredFlip.count,
    sweptCampaigns: targets.length,
    refundedOrders,
    runAt: now.toISOString(),
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
