import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { resolveSession } from "@/lib/api-auth";

/**
 * GET /api/v1/me/favorites — list of shops the current user has hearted.
 * Returns ShopSummary[] in the same shape as /api/v1/feed for easy reuse.
 */
export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const rows = await db.shopFavorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      shop: {
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
          rating: true,
          totalSold: true,
          contact: true,
          announcement: true,
        },
      },
    },
  });

  return ok({
    shops: rows
      .map((r) => r.shop)
      .filter((s) => s !== null),
  });
}
