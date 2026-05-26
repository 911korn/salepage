import { db, ShopStatus, ProductStatus, KycStatus, type Prisma } from "@/lib/db";

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

  const shopFilter: Prisma.ShopWhereInput = {
    status: ShopStatus.ACTIVE,
    suspended: false,
    ...(q.category ? { category: q.category } : {}),
    ...(q.verified ? { kycStatus: KycStatus.VERIFIED } : {}),
  };

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

  const products = await db.product.findMany({
    where: { status: ProductStatus.ACTIVE, shop: shopFilter },
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
    })),
    nextCursor: hasMore ? slice[slice.length - 1]!.id : null,
  };
}
