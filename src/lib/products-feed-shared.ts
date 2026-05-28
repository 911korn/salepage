import {
  db,
  ShopStatus,
  ProductStatus,
  KycStatus,
  ProductCondition,
  ProductType,
  SubscriptionStatus,
  PlanKey,
  type Prisma,
} from "@/lib/db";
import { getPlatformSetting } from "@/lib/platform-settings";

/**
 * Shared product-feed core. Used by BOTH `/api/v1/products-feed` (mobile)
 * and the web `(buyer)/shops` server component so the marketplace feed
 * stays identical across surfaces (911korn 2026-05-27 "ใช้ api อันเดียว
 * กันนะ คอร์สแพลตฟอร์ม").
 */

export const PRODUCTS_FEED_PAGE_SIZE = 20;

export type FeedSort =
  | "relevance"
  | "sold"
  | "newest"
  | "price-asc"
  | "price-desc";

interface ProductsFeedQuery {
  cursor?: string;
  category?: string;
  sort?: FeedSort;
  verified?: boolean;
  pageSize?: number;
  /** Restrict to PRE_OWNED (มือสอง) listings only. */
  condition?: ProductCondition;
}

export interface FeedProductRow {
  id: string;
  slug: string;
  shopSlug: string;
  shopName: string;
  shopLogoText: string | null;
  shopLogoUrl: string | null;
  shopThemeColor: string;
  shopKycStatus: KycStatus;
  shopTrustScore: number;
  shopRating: number;
  name: string;
  priceSatang: number;
  compareAtSatang: number | null;
  imageUrl: string | null;
  badge: string | null;
  sold: number;
  category: string | null;
  /** "NEW" | "PRE_OWNED". UI surfaces a "มือสอง" badge for PRE_OWNED. */
  condition: ProductCondition;
  /** "PHYSICAL" | "DIGITAL". Drives the violet "ดิจิทัล" tag. */
  type: ProductType;
  /** "ACTIVE" | "SOLD_OUT" — only these two ever flow through the feed. */
  status: "ACTIVE" | "SOLD_OUT";
}

export interface ProductsFeedResult {
  products: FeedProductRow[];
  nextCursor: string | null;
}

export async function getProductsFeed(
  q: ProductsFeedQuery = {},
): Promise<ProductsFeedResult> {
  const sort = q.sort ?? "relevance";
  const pageSize = q.pageSize ?? PRODUCTS_FEED_PAGE_SIZE;

  // Super-admin toggle: when enabled, the buyer marketplace only shows
  // shops whose owner is on Pro / Business / Agency. Free-tier shops
  // are NOT delisted — they're just removed from discovery (their
  // storefront URL still works for buyers arriving via shared link).
  const feedSetting = await getPlatformSetting("feed_pro_only");
  const proOnlyShopFilter: Prisma.ShopWhereInput | undefined = feedSetting.enabled
    ? {
        owner: {
          subscription: {
            plan: { in: [PlanKey.PRO, PlanKey.BUSINESS, PlanKey.AGENCY] },
            status: {
              in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
            },
          },
        },
      }
    : undefined;

  const shopFilter: Prisma.ShopWhereInput = {
    status: ShopStatus.ACTIVE,
    suspended: false,
    ...(q.verified ? { kycStatus: KycStatus.VERIFIED } : {}),
    ...(proOnlyShopFilter ?? {}),
  };

  // Category filter is on the PRODUCT itself when set, with a fallback
  // to the shop's category for legacy rows whose products didn't carry
  // their own category. (Most products before V2.1 will have null
  // product.category.)
  const categoryFilter: Prisma.ProductWhereInput | undefined = q.category
    ? {
        OR: [
          { category: q.category },
          { AND: [{ category: null }, { shop: { category: q.category } }] },
        ],
      }
    : undefined;

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "sold"
      ? [{ sold: "desc" }, { createdAt: "desc" }]
      : sort === "newest"
        ? [{ createdAt: "desc" }]
        : sort === "price-asc"
          ? [{ priceSatang: "asc" }]
          : sort === "price-desc"
            ? [{ priceSatang: "desc" }]
            : // relevance — approx: sold then recency; featured-shop boost
              // applied via shop filter ordering when catalog is small.
              [{ sold: "desc" }, { createdAt: "desc" }];

  // SOLD_OUT listings stay in the feed for 4h after the last unit
  // sold — gives the marketplace a "fresh activity" signal (911korn
  // 2026-05-27 "มันจะได้ดูรู้สึกว่ามีการเคลื่อนไหว"). After 4h, the
  // listing drops off until the seller tops up stock.
  //
  // The third OR branch is a defensive net: if a product somehow ends
  // up `stock=0` while still flagged ACTIVE (data drift, or sale that
  // pre-dated the auto-SOLD_OUT updateMany), we treat it as sold-out
  // anyway — show it for 4h after updatedAt, then drop. The map step
  // below also derives `status="SOLD_OUT"` for those rows so the card
  // renders the ribbon correctly.
  const FOUR_HOURS_AGO = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const products = await db.product.findMany({
    where: {
      shop: shopFilter,
      ...(categoryFilter ?? {}),
      ...(q.condition ? { condition: q.condition } : {}),
      // Hide products without images from the buyer feed entirely.
      // 911korn 2026-05-28 "ต้องมีรูปทุกสินค้า · ถ้า item ไม่มีรูป
      // ห้ามขึ้น เลย". Seller dashboard still sees them (different query).
      NOT: [{ imageUrls: { equals: [] } }],
      OR: [
        // Truly active — explicit ACTIVE + has stock (or unlimited)
        {
          status: ProductStatus.ACTIVE,
          OR: [{ stock: null }, { stock: { gt: 0 } }],
        },
        // Explicit SOLD_OUT inside the 4h window
        {
          status: ProductStatus.SOLD_OUT,
          soldOutAt: { gte: FOUR_HOURS_AGO },
        },
        // Drift safety net — ACTIVE w/ stock=0, surface for 4h
        // after last update then auto-drop
        {
          status: ProductStatus.ACTIVE,
          stock: 0,
          updatedAt: { gte: FOUR_HOURS_AGO },
        },
      ],
    },
    orderBy,
    take: pageSize + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      slug: true,
      name: true,
      priceSatang: true,
      compareAtSatang: true,
      imageUrls: true,
      badge: true,
      sold: true,
      category: true,
      condition: true,
      type: true,
      status: true,
      stock: true,
      shop: {
        select: {
          slug: true,
          name: true,
          logoText: true,
          logoUrl: true,
          themeColor: true,
          kycStatus: true,
          trustScore: true,
          rating: true,
          category: true,
        },
      },
    },
  });

  const hasMore = products.length > pageSize;
  const slice = hasMore ? products.slice(0, pageSize) : products;
  return {
    products: slice.map((p) => ({
      id: p.id,
      slug: p.slug,
      shopSlug: p.shop.slug,
      shopName: p.shop.name,
      shopLogoText: p.shop.logoText,
      shopLogoUrl: p.shop.logoUrl,
      shopThemeColor: p.shop.themeColor,
      shopKycStatus: p.shop.kycStatus,
      shopTrustScore: p.shop.trustScore,
      shopRating: p.shop.rating,
      name: p.name,
      priceSatang: p.priceSatang,
      compareAtSatang: p.compareAtSatang,
      imageUrl: p.imageUrls[0] ?? null,
      badge: p.badge,
      sold: p.sold,
      // Falls back to the shop-level category so legacy products still
      // surface a category pill on the marketplace cards.
      category: p.category ?? p.shop.category ?? null,
      condition: p.condition,
      type: p.type,
      // Derive: stock=0 ALWAYS reads as SOLD_OUT regardless of the
      // explicit status column. Belt-and-suspenders for legacy rows
      // whose SOLD_OUT stamping pre-dates V2.1 (911korn 2026-05-27
      // screenshot 08:20 — sold-out card was leaking through).
      status:
        p.stock === 0 || p.status === "SOLD_OUT"
          ? ("SOLD_OUT" as const)
          : ("ACTIVE" as const),
    })),
    nextCursor: hasMore ? slice[slice.length - 1]!.id : null,
  };
}
