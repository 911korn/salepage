import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";

/**
 * GET /api/v1/cron/expire-stories
 *
 * Hourly sweep that hard-deletes stories whose `expiresAt < now`. We
 * delete rather than soft-flag because (a) stories are intentionally
 * ephemeral and (b) the `shop.stories` relation list query is filtered
 * by expiresAt anyway — keeping rows around would just bloat the table.
 *
 * Schedule in vercel.json: `0 * * * *` (hourly on the hour).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorized(request)) {
    return fail("unauthorized", "Cron auth required", 401);
  }

  const result = await db.shopStory.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return ok({
    deleted: result.count,
    timestamp: new Date().toISOString(),
  });
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (request.headers.has("x-vercel-cron-signature")) return true;
  return false;
}
