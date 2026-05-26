import { ok, fail } from "@/lib/api";
import { db, OrderStatus } from "@/lib/db";

/**
 * GET /api/v1/cron/expire-pending-orders
 *
 * Runs every 5 minutes. Cancels any PENDING order older than the 15-min
 * payment window so the customer's mobile app countdown timer doesn't lie
 * (and so we don't reserve PromptPay QR amounts indefinitely on
 * the seller's side).
 *
 * Idempotent — safe to run repeatedly. Doesn't touch PAID/SHIPPING/etc.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes — same window as the buyer-side countdown

export async function GET(request: Request) {
  if (!authorized(request)) {
    return fail("unauthorized", "Cron auth required", 401);
  }

  const cutoff = new Date(Date.now() - WINDOW_MS);

  // Bulk update — Prisma supports updateMany without per-row notifications.
  // We don't push-notify customers on auto-expiry; the countdown UI already
  // signals "หมดเวลา" client-side.
  const result = await db.order.updateMany({
    where: {
      status: OrderStatus.PENDING,
      createdAt: { lt: cutoff },
    },
    data: { status: OrderStatus.CANCELLED },
  });

  return ok({
    expired: result.count,
    cutoff: cutoff.toISOString(),
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
