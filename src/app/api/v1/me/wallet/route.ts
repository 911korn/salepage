import { resolveSession } from "@/lib/api-auth";
import { ok } from "@/lib/api";
import { db } from "@/lib/db";

/**
 * GET /api/v1/me/wallet
 *
 * Cross-shop loyalty wallet for the current user. Aggregates every
 * `CustomerLoyalty` row keyed by the buyer's phone number (the de-facto
 * cross-shop identifier in our schema).
 *
 * We walk the user's recent orders to discover which phone(s) they've used,
 * then JOIN to CustomerLoyalty for each (shop, phone) pair. A user can have
 * multiple phones over time (e.g. number ported); we surface all wallets so
 * none are silently invisible.
 *
 * Response shape:
 *   {
 *     wallets: [{ shop, customerPhone, points, totalSpentSatang, config }],
 *     totals: { totalPoints, totalSpentSatang, shopCount }
 *   }
 */
const LOOKBACK_ORDERS = 100;

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { user } = session;

  // Identity discovery — same shape as `/me/addresses` route. We need the
  // LINE userIds + email to find the user's past orders.
  const lineUserIds = await db.account
    .findMany({
      where: { userId: user.id, provider: "line" },
      select: { providerAccountId: true },
    })
    .then((rows) => rows.map((r) => r.providerAccountId));

  const customerWhere = {
    OR: [
      ...(user.email ? [{ customerEmail: user.email }] : []),
      ...(lineUserIds.length > 0
        ? [{ customerLineUserId: { in: lineUserIds } }]
        : []),
    ],
  };

  if (customerWhere.OR.length === 0) {
    return ok({
      wallets: [],
      totals: { totalPoints: 0, totalSpentSatang: 0, shopCount: 0 },
    });
  }

  // Discover (shopId, customerPhone) pairs the buyer has used.
  const recentOrders = await db.order.findMany({
    where: {
      ...customerWhere,
      customerPhone: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: LOOKBACK_ORDERS,
    select: {
      shopId: true,
      customerPhone: true,
    },
  });

  const pairs = new Set<string>();
  for (const o of recentOrders) {
    if (!o.customerPhone) continue;
    const phone = o.customerPhone.replace(/[^\d]/g, "");
    if (phone.length < 9) continue;
    pairs.add(`${o.shopId}|${phone}`);
  }

  if (pairs.size === 0) {
    return ok({
      wallets: [],
      totals: { totalPoints: 0, totalSpentSatang: 0, shopCount: 0 },
    });
  }

  // Fetch wallet rows + shop metadata in parallel.
  const wallets = await Promise.all(
    Array.from(pairs).map(async (key) => {
      const [shopId, customerPhone] = key.split("|") as [string, string];
      const wallet = await db.customerLoyalty.findUnique({
        where: { shopId_customerPhone: { shopId, customerPhone } },
        include: {
          shop: {
            select: {
              id: true,
              slug: true,
              name: true,
              logoText: true,
              logoUrl: true,
              themeColor: true,
              loyaltyBahtPerPoint: true,
              loyaltyBahtValuePerPoint: true,
            },
          },
        },
      });
      return wallet;
    }),
  );

  // Filter null (no wallet yet for that shop) and shape for the client.
  const populated = wallets
    .filter((w): w is NonNullable<typeof w> => w !== null && w.points > 0)
    .sort((a, b) => b.points - a.points);

  const totals = populated.reduce(
    (acc, w) => ({
      totalPoints: acc.totalPoints + w.points,
      totalSpentSatang: acc.totalSpentSatang + w.totalSpentSatang,
      shopCount: acc.shopCount + 1,
    }),
    { totalPoints: 0, totalSpentSatang: 0, shopCount: 0 },
  );

  return ok({
    wallets: populated.map((w) => ({
      shop: w.shop,
      customerPhone: w.customerPhone,
      points: w.points,
      totalSpentSatang: w.totalSpentSatang,
      config: {
        bahtPerPoint: w.shop.loyaltyBahtPerPoint,
        bahtValuePerPoint: w.shop.loyaltyBahtValuePerPoint,
      },
    })),
    totals,
  });
}
