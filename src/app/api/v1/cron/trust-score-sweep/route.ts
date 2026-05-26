import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { recomputeTrustScore } from "@/lib/trust-score";

/**
 * GET /api/v1/cron/trust-score-sweep
 *
 * Monthly cron — recomputes the `trustScore` for every active shop. Mainly
 * to capture decayed signals: shops that haven't taken an order in 90 days,
 * KYC verifications that have aged past the 365-day threshold, etc.
 *
 * Vercel Cron schedule: `0 18 1 * *` (1st of each month, 6pm UTC = 1am ICT
 * the 2nd — outside business hours so the spike on Neon doesn't compete
 * with checkout traffic).
 *
 * Auth: Vercel signs cron requests with `x-vercel-cron-signature` and a
 * shared secret in `CRON_SECRET`. We accept either:
 *   - `Authorization: Bearer <CRON_SECRET>` (the documented method)
 *   - the Vercel signature header (set by the platform automatically)
 * In dev/no-secret mode we allow all so `curl localhost:3000/...` works.
 */
export const runtime = "nodejs";
// Long-running sweep — give us 5 minutes since we're potentially scoring
// thousands of shops sequentially. Vercel's cron fns can run up to 15 min.
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!authorized(request)) {
    return fail("unauthorized", "Cron auth required", 401);
  }

  const shops = await db.shop.findMany({
    where: { suspended: false },
    select: { id: true, slug: true },
  });

  let success = 0;
  let failed = 0;
  // Sequential to avoid hammering the DB. With ~1k shops at ~50ms each this
  // takes <1 minute. Switch to chunked Promise.all if we ever exceed 5k.
  for (const shop of shops) {
    try {
      await recomputeTrustScore(shop.id);
      success++;
    } catch (err) {
      console.error(`[cron] trust score recompute failed for ${shop.slug}`, err);
      failed++;
    }
  }

  return ok({
    swept: shops.length,
    success,
    failed,
    timestamp: new Date().toISOString(),
  });
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Local dev: skip auth so contributors can poke the endpoint.
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  // Vercel auto-signs cron invocations; trust their header.
  if (request.headers.has("x-vercel-cron-signature")) return true;
  return false;
}
