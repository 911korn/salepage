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
 * Auth: `Authorization: Bearer <CRON_SECRET>`, which Vercel Cron sends
 * automatically. The mere presence of a signature header is not proof, so
 * it is not accepted on its own.
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
  if (!secret) {
    // Fail closed: these jobs move money/order state. Vercel Cron sends
    // `Authorization: Bearer $CRON_SECRET` once the env var is set.
    console.error("[cron] CRON_SECRET is not set - refusing to run");
    return false;
  }
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return false;
}
