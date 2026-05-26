import { db, ShopStatus, KycStatus, type Prisma } from "@/lib/db";

/**
 * Shared discovery-feed query — single source of truth used by BOTH the
 * public API route (`/api/v1/feed`) and server components on the web
 * (`/shops`, `/`). When the ranking algorithm or shop-select shape
 * evolves, both surfaces pick it up automatically (911korn 2026-05-27:
 * "ทำให้มันใช้ api อันเดียวกันนะ คอร์สแพลตฟอร์ม").
 */
export const FEED_PAGE_SIZE = 20;

export const FEED_SHOP_SELECT = {
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
  featured: true,
  createdAt: true,
} satisfies Prisma.ShopSelect;

export type FeedShop = Prisma.ShopGetPayload<{ select: typeof FEED_SHOP_SELECT }>;

export interface FeedQuery {
  cursor?: string;
  category?: string;
  tab?: "for-you" | "new" | "following";
  verified?: boolean;
  /** Required for the "following" tab; ignored otherwise. */
  userId?: string;
  pageSize?: number;
}

export interface FeedResult {
  shops: FeedShop[];
  nextCursor: string | null;
}

/**
 * Run the discovery query. Tab semantics:
 *  - "for-you" (default): featured > popular > rating > newest
 *  - "new":   last 30 days, newest first
 *  - "following": only when `userId` is set (else throws); shops the user follows
 */
export async function getDiscoveryFeed(q: FeedQuery): Promise<FeedResult> {
  const tab = q.tab ?? "for-you";
  const pageSize = q.pageSize ?? FEED_PAGE_SIZE;
  const verifiedFilter = q.verified ? { kycStatus: KycStatus.VERIFIED } : {};

  if (tab === "following") {
    if (!q.userId) {
      return { shops: [], nextCursor: null };
    }
    const followed = await db.shopFollow.findMany({
      where: {
        userId: q.userId,
        ...(q.verified ? { shop: verifiedFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      ...(q.cursor
        ? {
            cursor: { userId_shopId: { userId: q.userId, shopId: q.cursor } },
            skip: 1,
          }
        : {}),
      select: { shop: { select: FEED_SHOP_SELECT } },
    });
    const slice = followed.length > pageSize ? followed.slice(0, pageSize) : followed;
    const shops = slice
      .map((r) => r.shop)
      .filter((s): s is FeedShop => s !== null);
    return {
      shops,
      nextCursor:
        followed.length > pageSize && shops.length > 0
          ? shops[shops.length - 1]!.id
          : null,
    };
  }

  const where: Prisma.ShopWhereInput = {
    status: ShopStatus.ACTIVE,
    suspended: false,
    ...(q.category ? { category: q.category } : {}),
    ...verifiedFilter,
  };

  if (tab === "new") {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const shops = await db.shop.findMany({
      where: { ...where, createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: FEED_SHOP_SELECT,
    });
    const slice = shops.length > pageSize ? shops.slice(0, pageSize) : shops;
    return {
      shops: slice,
      nextCursor: shops.length > pageSize ? slice[slice.length - 1]!.id : null,
    };
  }

  // for-you (default)
  const shops = await db.shop.findMany({
    where,
    orderBy: [
      { featured: "desc" },
      { totalSold: "desc" },
      { rating: "desc" },
      { createdAt: "desc" },
    ],
    take: pageSize + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    select: FEED_SHOP_SELECT,
  });
  const slice = shops.length > pageSize ? shops.slice(0, pageSize) : shops;
  return {
    shops: slice,
    nextCursor: shops.length > pageSize ? slice[slice.length - 1]!.id : null,
  };
}
