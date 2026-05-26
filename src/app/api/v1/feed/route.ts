import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { db, ShopStatus } from "@/lib/db";
import { resolveSession } from "@/lib/api-auth";

/**
 * GET /api/v1/feed?cursor=&category=&tab=for-you|new|following
 *
 * V1.0 discovery feed. Three tabs:
 *  - "for-you" (default): popular shops, biased toward user's recent product
 *    views and viewed categories. Anonymous-friendly.
 *  - "new": shops created in the last 30 days, newest first.
 *  - "following": shops the user has hit POST /shops/:slug/follow on (auth required).
 *
 * Pagination uses cursor = shop.id of the last item.
 *
 * All responses respect:
 *  - Shop.suspended → excluded
 *  - Shop.status !== ACTIVE → excluded
 *  - Shop.featured → boosted to the top of the for-you tab
 */
const QuerySchema = z.object({
  cursor: z.string().optional(),
  category: z.string().optional(),
  tab: z.enum(["for-you", "new", "following"]).optional(),
  /// When true, only return KYC-verified shops. Used by the "Verified Only"
  /// toggle in the discovery feed (V1.5+).
  verified: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

const PAGE_SIZE = 20;

const SHOP_SELECT = {
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
  featured: true,
  createdAt: true,
} as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return fail("invalid_query", "Query string ไม่ถูกต้อง", 422);
  }
  const { cursor, category, tab = "for-you", verified } = parsed.data;
  // Verified filter is applied across all 3 tabs identically.
  const verifiedFilter = verified ? { kycStatus: "VERIFIED" as const } : {};

  if (tab === "following") {
    const session = await resolveSession(request);
    if (!session.ok) return session.response;
    const followed = await db.shopFollow.findMany({
      where: {
        userId: session.user.id,
        ...(verified ? { shop: verifiedFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { userId_shopId: { userId: session.user.id, shopId: cursor } }, skip: 1 } : {}),
      select: { shop: { select: SHOP_SELECT } },
    });
    const slice = followed.length > PAGE_SIZE ? followed.slice(0, PAGE_SIZE) : followed;
    const last = slice[slice.length - 1]?.shop?.id;
    return ok({
      shops: slice.map((r) => r.shop).filter((s): s is NonNullable<typeof s> => s !== null),
      nextCursor: followed.length > PAGE_SIZE && last ? last : null,
    });
  }

  const where = {
    status: ShopStatus.ACTIVE,
    suspended: false,
    ...(category ? { category } : {}),
    ...verifiedFilter,
  };

  if (tab === "new") {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const shops = await db.shop.findMany({
      where: { ...where, createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: SHOP_SELECT,
    });
    const slice = shops.length > PAGE_SIZE ? shops.slice(0, PAGE_SIZE) : shops;
    return ok({
      shops: slice,
      nextCursor: shops.length > PAGE_SIZE ? slice[slice.length - 1]!.id : null,
    });
  }

  // tab=for-you — popular feed.
  // V1.0 ranking proxy: featured first, then by totalSold desc, rating desc, recency.
  // V1.5 will add ProductView signal-based personalization.
  const shops = await db.shop.findMany({
    where,
    orderBy: [
      { featured: "desc" },
      { totalSold: "desc" },
      { rating: "desc" },
      { createdAt: "desc" },
    ],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: SHOP_SELECT,
  });
  const slice = shops.length > PAGE_SIZE ? shops.slice(0, PAGE_SIZE) : shops;
  return ok({
    shops: slice,
    nextCursor: shops.length > PAGE_SIZE ? slice[slice.length - 1]!.id : null,
  });
}
