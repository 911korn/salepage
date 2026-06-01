import { ok } from "@/lib/api";
import { db, ShopStatus, CouponType } from "@/lib/db";

/**
 * GET /api/v1/discovery-rails
 *
 * Composite home-feed garnish: returns the two horizontal rails that ride
 * above the main shop list — `featured` shops + `flashSale` coupons.
 *
 * Single round-trip on purpose so the home screen doesn't fan out three
 * separate queries (stories already adds its own request).
 *
 * - `featured`:  shops with `featured = true`, capped at 12, sorted by
 *   `totalSold` to surface higher-quality picks first.
 * - `flashSale`: coupons with a non-null `validUntil` in the next 72 hours
 *   AND `active = true`. Includes the parent shop summary so the rail can
 *   render shop name + theme color without N+1 lookups.
 */
export async function GET() {
  const now = new Date();
  const horizon = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  const [featured, flashCoupons] = await Promise.all([
    db.shop.findMany({
      where: {
        featured: true,
        suspended: false,
        status: ShopStatus.ACTIVE,
      },
      orderBy: [
        { totalSold: "desc" },
        { rating: "desc" },
        { createdAt: "desc" },
      ],
      take: 12,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        logoText: true,
        logoUrl: true,
        bannerUrls: true,
        category: true,
        themeColor: true,
        verified: true,
        kycStatus: true,
        trustScore: true,
        rating: true,
        totalSold: true,
        contact: true,
        announcement: true,
      },
    }),
    db.coupon.findMany({
      where: {
        active: true,
        // Only "flash" — coupons with an expiry inside the next 72h.
        expiresAt: { not: null, gte: now, lte: horizon },
        shop: { status: ShopStatus.ACTIVE, suspended: false },
      },
      orderBy: { expiresAt: "asc" },
      take: 12,
      select: {
        id: true,
        code: true,
        type: true,
        percent: true,
        amountSatang: true,
        minOrderSatang: true,
        expiresAt: true,
        shop: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoText: true,
            logoUrl: true,
            themeColor: true,
            kycStatus: true,
          },
        },
      },
    }),
  ]);

  return ok(
    {
    featured,
    flashSale: flashCoupons.map((c) => ({
      id: c.id,
      code: c.code,
      // Translate raw Prisma fields into the discrete discount value the
      // mobile UI shows (e.g. "-30%" vs "-50฿"). PERCENT uses `percent`
      // (1..100); FIXED uses `amountSatang` (in satang).
      kind: c.type === CouponType.PERCENT ? "percent" : "fixed",
      value:
        c.type === CouponType.PERCENT
          ? (c.percent ?? 0)
          : (c.amountSatang ?? 0),
      minOrderSatang: c.minOrderSatang,
      expiresAt: c.expiresAt,
      shop: c.shop,
    })),
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}
