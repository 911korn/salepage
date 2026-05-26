import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";

interface Ctx {
  params: Promise<{ slug: string; id: string }>;
}

/**
 * POST /api/v1/shops/:slug/stories/:id/view
 *
 * Best-effort view counter bump. Public — no auth required (anonymous
 * viewers count too). We don't dedupe by user; if a buyer rewatches the
 * same story we count both views. V2.1 can move to a sampled per-user
 * tracker if we ever surface per-shop analytics.
 */
export async function POST(_request: Request, ctx: Ctx) {
  const { slug, id } = await ctx.params;

  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);

  // updateMany so a missing/expired story silently no-ops (0 rows)
  // instead of throwing. We also guard against bumping expired stories.
  const result = await db.shopStory.updateMany({
    where: {
      id,
      shopId: shop.id,
      expiresAt: { gt: new Date() },
    },
    data: { viewCount: { increment: 1 } },
  });

  return ok({ bumped: result.count > 0 });
}
