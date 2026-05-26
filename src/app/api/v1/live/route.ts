import { ok } from "@/lib/api";
import { db, LiveBroadcastStatus, ShopStatus } from "@/lib/db";

/**
 * GET /api/v1/live
 *
 * Public discovery feed for live broadcasts. Two buckets in one response:
 *
 *   - `live`:      currently LIVE (sorted by viewerCount desc — popular shows first)
 *   - `upcoming`:  SCHEDULED with `scheduledAt` in the next 24h
 *
 * The home rail picks `live` first, then falls back to `upcoming` so the
 * mobile UI can render a single horizontal carousel without juggling
 * empty states.
 */
export async function GET() {
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const select = {
    id: true,
    title: true,
    coverImageUrl: true,
    status: true,
    scheduledAt: true,
    startedAt: true,
    viewerCount: true,
    pinnedProductSlug: true,
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
  } as const;

  const [live, upcoming] = await Promise.all([
    db.liveBroadcast.findMany({
      where: {
        status: LiveBroadcastStatus.LIVE,
        shop: { status: ShopStatus.ACTIVE, suspended: false },
      },
      orderBy: [{ viewerCount: "desc" }, { startedAt: "desc" }],
      take: 20,
      select,
    }),
    db.liveBroadcast.findMany({
      where: {
        status: LiveBroadcastStatus.SCHEDULED,
        scheduledAt: { gte: now, lte: horizon },
        shop: { status: ShopStatus.ACTIVE, suspended: false },
      },
      orderBy: { scheduledAt: "asc" },
      take: 20,
      select,
    }),
  ]);

  return ok({ live, upcoming });
}
