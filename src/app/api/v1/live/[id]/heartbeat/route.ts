import { ok, fail } from "@/lib/api";
import { db, LiveBroadcastStatus } from "@/lib/db";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/live/:id/heartbeat
 *
 * Best-effort viewer presence ping. The mobile watch screen calls this
 * every 30 seconds while the user is on the screen.
 *
 * `viewerCount` is reset to 0 by the seller's `end` action and otherwise
 * decays naturally — we use a `decay-viewer-counts` cron (not implemented
 * yet, V2.1) to subtract stale heartbeats. For now, the seller's "end"
 * transition is the only definitive zero-out.
 *
 * Returns 404 if the broadcast isn't currently LIVE so the client knows
 * to dismiss the watch screen.
 */
export async function POST(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  // updateMany with status filter so we don't 404 on a real broadcast that
  // just transitioned to ENDED — the response just reports `live: false`.
  const result = await db.liveBroadcast.updateMany({
    where: { id, status: LiveBroadcastStatus.LIVE },
    data: {
      viewerCount: { increment: 1 },
      totalViews: { increment: 1 },
    },
  });

  if (result.count === 0) {
    // Either id is bogus or the broadcast ended. Tell the client to bail.
    const exists = await db.liveBroadcast.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!exists) return fail("not_found", "ไม่พบไลฟ์นี้", 404);
    return ok({ live: false, status: exists.status });
  }

  return ok({ live: true });
}
