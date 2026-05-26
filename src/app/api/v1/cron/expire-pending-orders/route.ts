import { ok, fail } from "@/lib/api";
import { db, OrderStatus } from "@/lib/db";

/**
 * GET /api/v1/cron/expire-pending-orders
 *
 * Runs every 5 minutes. Cancels any PENDING order older than the
 * `WINDOW_MS` payment grace period. Sweeps abandoned carts so the
 * seller's PENDING inbox doesn't fill up with rows nobody intends
 * to pay, BUT the window is long enough that a legit buyer who paid
 * via PromptPay then forgot to upload the slip still has plenty of
 * time to come back and finish.
 *
 * The buyer can always cancel earlier themselves via the
 * "ยกเลิกออเดอร์" link on `/checkout/[token]` (`api.orders.cancel`).
 *
 * Idempotent — safe to run repeatedly. Doesn't touch PAID/SHIPPING/etc.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

// 7 days. Raised from 15 minutes after 911korn 2026-05-27 case:
// korn4564@gmail.com's 02:36 multi-shop order got auto-cancelled
// 15 minutes later because they didn't upload the slip in time, and
// they thought the order had "disappeared" rather than been killed.
// 7d gives the buyer real headroom; explicit user-cancel covers the
// "I changed my mind" path.
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  if (!authorized(request)) {
    return fail("unauthorized", "Cron auth required", 401);
  }

  const cutoff = new Date(Date.now() - WINDOW_MS);

  // Bulk update — Prisma supports updateMany without per-row notifications.
  // No push-notify on auto-expiry — at 7 days the buyer has long stopped
  // looking. The checkout screen just calls "ใช้สลิปได้ตามสะดวก" and the
  // order quietly drops out of /me/orders' PENDING tab when this runs.
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
