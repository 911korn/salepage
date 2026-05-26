import { db, OrderStatus, AffiliatePayoutStatus } from "@/lib/db";

/**
 * Affiliate commission engine.
 *
 * - Default rate: 2% of `Order.totalSatang`.
 * - Per-shop override: `Shop.affiliateRatePct` (capped 0–10).
 * - Buckets:
 *     pending   = PAID + SHIPPING (accrued, not payable until DELIVERED)
 *     paid      = DELIVERED       (locked-in commission, eligible for payout)
 *     cancelled = CANCELLED       (clawback / no commission)
 *
 * Payable balance = sum(paid commission) - sum(payouts not in REJECTED/CANCELLED).
 * That subtraction happens against ALL non-terminal-rejected payouts
 * (REQUESTED + APPROVED + PAID) so requesting locks the funds and PAID
 * deducts permanently. REJECTED + CANCELLED rows release the lock.
 */
export const DEFAULT_AFFILIATE_RATE_PCT = 2;
export const MAX_AFFILIATE_RATE_PCT = 10;

/**
 * Compute commission for a single order given the shop's effective rate.
 * Result floors to integer satang (no fractional cents).
 */
export function commissionFor(
  totalSatang: number,
  shopRatePct: number | null,
): number {
  const pct = clampRate(shopRatePct);
  return Math.floor((totalSatang * pct) / 100);
}

export function clampRate(ratePct: number | null | undefined): number {
  if (ratePct == null) return DEFAULT_AFFILIATE_RATE_PCT;
  return Math.max(0, Math.min(MAX_AFFILIATE_RATE_PCT, ratePct));
}

interface BalanceBucket {
  count: number;
  grossSatang: number;
  commissionSatang: number;
}

export interface AffiliateBalance {
  /** Eligible-for-payout commission, AFTER subtracting in-flight payouts. */
  payableSatang: number;
  /** Commission locked by REQUESTED/APPROVED/PAID payouts (not yet released). */
  reservedSatang: number;
  /** Pre-DELIVERED commission (PAID/SHIPPING) — not payable yet. */
  pendingSatang: number;
  /** Lifetime commission across DELIVERED orders. */
  lifetimePaidSatang: number;
  /** Lifetime commission across DELIVERED orders BEFORE clawbacks (display only). */
  lifetimeGrossSatang: number;
  /** Per-bucket counts for UI rollups. */
  buckets: {
    pending: BalanceBucket;
    paid: BalanceBucket;
    cancelled: BalanceBucket;
  };
}

/**
 * Compute the user's current affiliate balance. Single function — used by
 * both `GET /me/earnings` (read-only) and `POST /me/payouts` (locking).
 */
export async function computeAffiliateBalance(
  userId: string,
): Promise<AffiliateBalance> {
  // 1) Pull every attributed order with its shop's override rate.
  const orders = await db.order.findMany({
    where: { referrerUserId: userId },
    select: {
      status: true,
      totalSatang: true,
      shop: { select: { affiliateRatePct: true } },
    },
  });

  const buckets = {
    pending: { count: 0, grossSatang: 0, commissionSatang: 0 },
    paid: { count: 0, grossSatang: 0, commissionSatang: 0 },
    cancelled: { count: 0, grossSatang: 0, commissionSatang: 0 },
  };

  for (const o of orders) {
    const c = commissionFor(o.totalSatang, o.shop.affiliateRatePct);
    let key: "pending" | "paid" | "cancelled";
    if (o.status === OrderStatus.DELIVERED) key = "paid";
    else if (
      o.status === OrderStatus.PAID ||
      o.status === OrderStatus.SHIPPING
    )
      key = "pending";
    else key = "cancelled";

    buckets[key].count += 1;
    buckets[key].grossSatang += o.totalSatang;
    buckets[key].commissionSatang += c;
  }

  // 2) Sum payouts that have locked the funds. REJECTED + CANCELLED don't
  // count — they release the lock.
  const heldPayouts = await db.affiliatePayout.aggregate({
    where: {
      userId,
      status: {
        in: [
          AffiliatePayoutStatus.REQUESTED,
          AffiliatePayoutStatus.APPROVED,
          AffiliatePayoutStatus.PAID,
        ],
      },
    },
    _sum: { amountSatang: true },
  });

  const reservedSatang = heldPayouts._sum?.amountSatang ?? 0;
  const lifetimePaidSatang = buckets.paid.commissionSatang;
  const payableSatang = Math.max(0, lifetimePaidSatang - reservedSatang);

  return {
    payableSatang,
    reservedSatang,
    pendingSatang: buckets.pending.commissionSatang,
    lifetimePaidSatang,
    lifetimeGrossSatang: buckets.paid.grossSatang,
    buckets,
  };
}
