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

// "For you" (relevance) rotation — pull a pool of high-quality products,
// then deterministically shuffle with a seed that rolls over every 15
// minutes. Same seed within a 15-min window = stable order = cursor
// pagination works. New seed every 15 min = the home feed feels alive
// and every approved listing gets fair surface time (911korn 2026-05-28
// "ทำไมสินค้าหน้าแรกมันไม่ Rotage เลย"). Pool capped so a single query
// returns fast — fine while the active marketplace is in the low
// thousands; revisit when catalog growth makes this constraining.
const RELEVANCE_POOL_SIZE = 300;
const ROTATION_WINDOW_MS = 15 * 60 * 1000;

function currentRotationSeed(): number {
  return Math.floor(Date.now() / ROTATION_WINDOW_MS);
}

// mulberry32 — small, fast, deterministic PRNG. Good enough for shuffling
// a few hundred items; not cryptographic.
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

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
  const baseWhere: Prisma.ProductWhereInput = {
    shop: shopFilter,
    ...(categoryFilter ?? {}),
    ...(q.condition ? { condition: q.condition } : {}),
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
  };

  const baseSelect = {
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
  } satisfies Prisma.ProductSelect;

  // "For you" / relevance: fetch a quality-ranked pool, shuffle with a
  // 15-min rotating seed, paginate by offset within the shuffled pool.
  // Cursor format: `${seed}:${offset}` — different from the ID-based
  // cursor used by deterministic sorts.
  if (sort === "relevance") {
    const cursorParts = q.cursor?.split(":") ?? [];
    const cursorSeed =
      cursorParts.length === 2 && Number.isFinite(Number(cursorParts[0]))
        ? Number(cursorParts[0])
        : null;
    const cursorOffset =
      cursorParts.length === 2 && Number.isFinite(Number(cursorParts[1]))
        ? Math.max(0, Number(cursorParts[1]))
        : 0;
    const seed = cursorSeed ?? currentRotationSeed();

    const pool = await db.product.findMany({
      where: baseWhere,
      orderBy: [{ sold: "desc" }, { createdAt: "desc" }],
      take: RELEVANCE_POOL_SIZE,
      select: baseSelect,
    });
    const filteredPool = pool.filter(
      (p) => Array.isArray(p.imageUrls) && p.imageUrls.length > 0,
    );
    shuffleInPlace(filteredPool, mulberry32(seed));

    const slice = filteredPool.slice(cursorOffset, cursorOffset + pageSize);
    const nextOffset = cursorOffset + slice.length;
    const hasMore = nextOffset < filteredPool.length;
    return {
      products: slice.map(mapRow),
      nextCursor: hasMore ? `${seed}:${nextOffset}` : null,
    };
  }

  // Deterministic sorts — keep ID-based cursor pagination.
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "sold"
      ? [{ sold: "desc" }, { createdAt: "desc" }]
      : sort === "newest"
        ? [{ createdAt: "desc" }]
        : sort === "price-asc"
          ? [{ priceSatang: "asc" }]
          : /* sort === "price-desc" */ [{ priceSatang: "desc" }];

  const products = await db.product.findMany({
    where: baseWhere,
    orderBy,
    take: pageSize + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    select: baseSelect,
  });

  // Post-query filter — hide products without images from buyer surfaces.
  // 911korn 2026-05-28 "ถ้า item ไม่มีรูป ห้ามขึ้น เลย". Tried this as a
  // Prisma JSON `NOT: [{ imageUrls: { equals: [] } }]` filter first but
  // it returned zero rows on the JSONB column — the JSON equals operator
  // is unreliable for array shape comparison. Filtering in JS is simpler
  // and accurate; cursor pagination tolerates the slight skew.
  const filtered = products.filter(
    (p) => Array.isArray(p.imageUrls) && p.imageUrls.length > 0,
  );
  const hasMore = filtered.length > pageSize;
  const slice = hasMore ? filtered.slice(0, pageSize) : filtered;
  return {
    products: slice.map(mapRow),
    nextCursor: hasMore ? slice[slice.length - 1]!.id : null,
  };
}

type PoolRow = Prisma.ProductGetPayload<{
  select: {
    id: true;
    slug: true;
    name: true;
    priceSatang: true;
    compareAtSatang: true;
    imageUrls: true;
    badge: true;
    sold: true;
    category: true;
    condition: true;
    type: true;
    status: true;
    stock: true;
    shop: {
      select: {
        slug: true;
        name: true;
        logoText: true;
        logoUrl: true;
        themeColor: true;
        kycStatus: true;
        trustScore: true;
        rating: true;
        category: true;
      };
    };
  };
}>;

function mapRow(p: PoolRow): FeedProductRow {
  return {
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
    // imageUrls is a JSONB column typed as Prisma.JsonValue. Pool fetch +
    // post-query filter above guarantees Array.isArray + length>0, so the
    // first element is always present and string-shaped in practice.
    imageUrl: Array.isArray(p.imageUrls) ? (p.imageUrls[0] as string) ?? null : null,
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
  };
}
