import { resolveSession } from "@/lib/api-auth";
import { ok, fail } from "@/lib/api";
import { db, OrderStatus } from "@/lib/db";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/v1/shops/:slug/stats
 *
 * Lightweight summary for the seller dashboard home screen. We deliberately
 * keep this small (a handful of counts/sums) so it's safe to refetch on
 * pull-to-refresh without burning the DB.
 *
 * Returns:
 *   - pendingOrderCount: orders awaiting slip verification
 *   - paidOrderCount: orders paid but not yet shipped
 *   - shippingOrderCount: in-transit orders
 *   - todaySalesSatang: sum of PAID|SHIPPING|DELIVERED `totalSatang` for today
 *   - last7dSalesSatang: same but last 7 days
 *   - last30dSalesSatang: last 30 days
 *   - unreadConversationCount: Business+ inbox unread total (0 if not configured)
 */
export async function GET(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true, lineWebhookEnabled: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);
  if (shop.ownerId !== session.user.id) {
    return fail("forbidden", "เฉพาะเจ้าของร้านเท่านั้น", 403);
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOf7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOf30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const REVENUE_STATUSES = [
    OrderStatus.PAID,
    OrderStatus.SHIPPING,
    OrderStatus.DELIVERED,
  ];

  // Fan out — Prisma can run these in parallel against Neon. Aggregating
  // server-side is cheaper than streaming all rows back.
  const [
    pendingOrderCount,
    paidOrderCount,
    shippingOrderCount,
    todayAgg,
    last7dAgg,
    last30dAgg,
    unreadAgg,
  ] = await Promise.all([
    db.order.count({
      where: { shopId: shop.id, status: OrderStatus.PENDING },
    }),
    db.order.count({
      where: { shopId: shop.id, status: OrderStatus.PAID },
    }),
    db.order.count({
      where: { shopId: shop.id, status: OrderStatus.SHIPPING },
    }),
    db.order.aggregate({
      where: {
        shopId: shop.id,
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: startOfToday },
      },
      _sum: { totalSatang: true },
    }),
    db.order.aggregate({
      where: {
        shopId: shop.id,
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: startOf7d },
      },
      _sum: { totalSatang: true },
    }),
    db.order.aggregate({
      where: {
        shopId: shop.id,
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: startOf30d },
      },
      _sum: { totalSatang: true },
    }),
    // Conversations only matter for Business+ shops with the LINE webhook
    // wired up. Other shops always see 0.
    shop.lineWebhookEnabled
      ? db.conversation.aggregate({
          where: { shopId: shop.id },
          _sum: { unreadCount: true },
        })
      : Promise.resolve({ _sum: { unreadCount: 0 } }),
  ]);

  return ok({
    pendingOrderCount,
    paidOrderCount,
    shippingOrderCount,
    todaySalesSatang: todayAgg._sum.totalSatang ?? 0,
    last7dSalesSatang: last7dAgg._sum.totalSatang ?? 0,
    last30dSalesSatang: last30dAgg._sum.totalSatang ?? 0,
    unreadConversationCount: unreadAgg._sum.unreadCount ?? 0,
  });
}
