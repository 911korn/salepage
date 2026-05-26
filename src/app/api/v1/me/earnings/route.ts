import { resolveSession } from "@/lib/api-auth";
import { ok } from "@/lib/api";
import { db, OrderStatus } from "@/lib/db";
import {
  commissionFor,
  computeAffiliateBalance,
  DEFAULT_AFFILIATE_RATE_PCT,
} from "@/lib/affiliate";

/**
 * GET /api/v1/me/earnings
 *
 * Affiliate earnings rollup for the current user. Three views in one
 * payload:
 *
 *   - `balance`: payable / reserved / pending (drives the "ขอรับเงิน" CTA)
 *   - `buckets`: pending / paid / cancelled (drives the bucket tabs)
 *   - `recent`: 200 most-recent attributed orders (drives the order list)
 *   - `payouts`: 20 most-recent payout requests (drives the history feed)
 *
 * Per-shop commission rates honored via `Shop.affiliateRatePct` (default 2%).
 */
export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { user } = session;

  const balance = await computeAffiliateBalance(user.id);

  // 200 most-recent attributed orders for the recent feed. Older orders
  // still count in `balance.buckets` (which scans all attributed rows).
  const orders = await db.order.findMany({
    where: { referrerUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      publicToken: true,
      status: true,
      totalSatang: true,
      createdAt: true,
      referrerCode: true,
      shop: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoText: true,
          themeColor: true,
          affiliateRatePct: true,
        },
      },
    },
  });

  const recent = orders.map((o) => {
    const c = commissionFor(o.totalSatang, o.shop.affiliateRatePct);
    let bucket: "pending" | "paid" | "cancelled";
    if (o.status === OrderStatus.DELIVERED) bucket = "paid";
    else if (
      o.status === OrderStatus.PAID ||
      o.status === OrderStatus.SHIPPING
    )
      bucket = "pending";
    else bucket = "cancelled";

    return {
      orderId: o.id,
      token: o.publicToken,
      status: o.status,
      totalSatang: o.totalSatang,
      commissionSatang: c,
      shop: {
        id: o.shop.id,
        slug: o.shop.slug,
        name: o.shop.name,
        logoText: o.shop.logoText,
        themeColor: o.shop.themeColor,
      },
      referrerCode: o.referrerCode,
      createdAt: o.createdAt,
      bucket,
    };
  });

  const payouts = await db.affiliatePayout.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      amountSatang: true,
      promptpayId: true,
      status: true,
      providerRef: true,
      rejectedReason: true,
      paidAt: true,
      reviewedAt: true,
      createdAt: true,
    },
  });

  return ok({
    rate: { pct: DEFAULT_AFFILIATE_RATE_PCT },
    balance,
    // Legacy shape — keep `buckets` at top level so old mobile builds
    // (which read `data.buckets.paid.commissionSatang` directly) keep
    // working even after this refactor lands.
    buckets: balance.buckets,
    lifetime: {
      grossSatang: balance.lifetimeGrossSatang,
      commissionSatang: balance.lifetimePaidSatang,
      orderCount: balance.buckets.paid.count,
    },
    recent,
    payouts,
  });
}
