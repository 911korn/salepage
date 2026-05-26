import { ok } from "@/lib/api";
import { db, ShopStatus } from "@/lib/db";

/**
 * GET /api/v1/categories — categories with active-shop counts.
 *
 * Mirrors the same allowed list used by the shop create form
 * (src/app/api/v1/shops/route.ts). Cached for 60s — shop creation rate is low
 * relative to read traffic.
 */
const CATEGORIES = [
  "fashion",
  "food",
  "tech",
  "beauty",
  "health",
  "furniture",
  "pets",
  "books",
  "sport",
  "other",
] as const;

export async function GET() {
  const counts = await db.shop.groupBy({
    by: ["category"],
    where: { status: ShopStatus.ACTIVE, suspended: false },
    _count: { _all: true },
  });

  const map = new Map(counts.map((c) => [c.category ?? "", c._count._all]));
  return ok({
    categories: CATEGORIES.map((key) => ({
      key,
      shopCount: map.get(key) ?? 0,
    })),
  });
}
