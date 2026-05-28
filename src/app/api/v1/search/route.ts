import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { db, ShopStatus, ProductStatus } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getBlockedOwnerIds } from "@/lib/blocks";

/**
 * GET /api/v1/search?q=...&category=...&sort=&cursor=
 *
 * V1.0 search across shops + products. We use Postgres `contains`-style ILIKE
 * for now. Acceptable up to ~50k shops; beyond that we'll move to GIN indexes
 * with `pg_trgm` or swap in Algolia (see ROADMAP "Open Questions").
 */
const QuerySchema = z.object({
  q: z.string().min(1).max(80),
  category: z.string().optional(),
  sort: z.enum(["relevance", "sold", "price-asc", "price-desc", "newest"]).default("relevance"),
  cursor: z.string().optional(),
  /// Restrict results to KYC-verified shops only.
  verified: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
  /// Inclusive price range in satang. Empty = no bound.
  minPriceSatang: z.coerce.number().int().min(0).optional(),
  maxPriceSatang: z.coerce.number().int().min(0).optional(),
  /// Minimum shop rating 1–5 (V1 uses Shop.rating, computed on review write).
  minRating: z.coerce.number().min(1).max(5).optional(),
});

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return fail("invalid_query", "ใส่คำค้นหา (q) ด้วย", 422);
  }
  const { q, category, sort, cursor, verified, minPriceSatang, maxPriceSatang, minRating } = parsed.data;
  const session = await auth();
  const blockedOwnerIds = await getBlockedOwnerIds(session?.user?.id ?? null);
  const blockFilter = blockedOwnerIds.length
    ? { ownerId: { notIn: blockedOwnerIds } }
    : {};
  const verifiedShopFilter = verified ? { kycStatus: "VERIFIED" as const } : {};
  const ratingFilter = minRating ? { rating: { gte: minRating } } : {};
  const priceFilter =
    minPriceSatang !== undefined || maxPriceSatang !== undefined
      ? {
          priceSatang: {
            ...(minPriceSatang !== undefined ? { gte: minPriceSatang } : {}),
            ...(maxPriceSatang !== undefined ? { lte: maxPriceSatang } : {}),
          },
        }
      : {};

  // Two parallel queries: matching shops + matching products. We cap each at
  // PAGE_SIZE so the combined response renders quickly. Pagination via cursor
  // applies to products only (shops top section is a sticky preview).
  const [shops, products] = await Promise.all([
    cursor
      ? Promise.resolve([])
      : db.shop.findMany({
          where: {
            status: ShopStatus.ACTIVE,
            suspended: false,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
            ...(category ? { category } : {}),
            ...verifiedShopFilter,
            ...ratingFilter,
            ...blockFilter,
          },
          orderBy: [{ featured: "desc" }, { totalSold: "desc" }],
          take: 6, // shops shown as a chip rail above products
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
    db.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        shop: {
          status: ShopStatus.ACTIVE,
          suspended: false,
          ...(category ? { category } : {}),
          ...verifiedShopFilter,
          ...ratingFilter,
          ...blockFilter,
        },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
        ...priceFilter,
      },
      orderBy:
        sort === "sold"
          ? { sold: "desc" }
          : sort === "price-asc"
            ? { priceSatang: "asc" }
            : sort === "price-desc"
              ? { priceSatang: "desc" }
              : sort === "newest"
                ? { createdAt: "desc" }
                : [{ sold: "desc" }, { createdAt: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        slug: true,
        name: true,
        priceSatang: true,
        imageUrls: true,
        shop: {
          select: {
            slug: true,
            name: true,
            kycStatus: true,
            trustScore: true,
          },
        },
      },
    }),
  ]);

  // Filter out products with no image — buyer-only rule, see
  // /lib/products-feed-shared.ts for the same approach.
  const withImages = products.filter(
    (p) => Array.isArray(p.imageUrls) && p.imageUrls.length > 0,
  );
  const hasMore = withImages.length > PAGE_SIZE;
  const productSlice = hasMore ? withImages.slice(0, PAGE_SIZE) : withImages;

  return ok({
    shops,
    products: productSlice.map((p) => ({
      slug: p.slug,
      shopSlug: p.shop.slug,
      shopName: p.shop.name,
      shopKycStatus: p.shop.kycStatus,
      shopTrustScore: p.shop.trustScore,
      name: p.name,
      priceSatang: p.priceSatang,
      imageUrl: p.imageUrls[0] ?? null,
    })),
    nextCursor: hasMore ? productSlice[productSlice.length - 1]!.id : null,
  });
}
