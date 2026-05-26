import { ok, fail } from "@/lib/api";
import { db, EscrowStatus, DisputeStatus } from "@/lib/db";
import { releaseEscrowHold } from "@/lib/escrow";
import { notifyEscrowReleasedToShop } from "@/lib/push-notify";

/**
 * GET /api/v1/cron/auto-release-escrow
 *
 * Releases EscrowHold rows whose `scheduledReleaseAt` has passed AND whose
 * Order has no open dispute. Runs every 6h (configured in vercel.json).
 *
 * The 72h window is calculated at DELIVERED time (see
 * `markEscrowDelivered`), so this cron is just sweep + release. We don't
 * race the dispute auto-resolver because:
 *   1. Disputes flip escrow into DISPUTED state (see `freezeEscrowForDispute`),
 *      which excludes the row from our `status=HELD` filter.
 *   2. Even if a dispute is opened in the same minute as the cron run,
 *      worst-case we release first and the dispute resolver subsequently
 *      handles it via admin refund. The 72h window is intentionally long.
 *
 * Safety net: we cap per-run releases at 200 rows. If we ever hit that we
 * log a warning so an operator can investigate (would imply ~800 releases/day
 * which is well above plausible V1.5 volume).
 */
const PER_RUN_CAP = 200;

export async function GET(request: Request) {
  if (!authorized(request)) {
    return fail("unauthorized", "Cron auth required", 401);
  }

  const now = new Date();
  const candidates = await db.escrowHold.findMany({
    where: {
      status: EscrowStatus.HELD,
      scheduledReleaseAt: { lte: now },
      // Defensive: skip if an open dispute exists on the order. The DISPUTED
      // state should already exclude these, but a race between cron + dispute
      // open is possible; this `none` clause is the belt-and-suspenders.
      order: {
        disputes: {
          none: {
            status: {
              in: [
                DisputeStatus.OPEN,
                DisputeStatus.AWAITING_SHOP_RESPONSE,
                DisputeStatus.AWAITING_BUYER_RESPONSE,
              ],
            },
          },
        },
      },
    },
    take: PER_RUN_CAP,
    orderBy: { scheduledReleaseAt: "asc" },
    select: {
      id: true,
      amountSatang: true,
      order: {
        select: {
          publicToken: true,
          shop: { select: { ownerId: true } },
        },
      },
    },
  });

  if (candidates.length === PER_RUN_CAP) {
    console.warn(
      `[cron/auto-release-escrow] hit per-run cap of ${PER_RUN_CAP} — investigate volume`,
    );
  }

  let released = 0;
  let skipped = 0;
  for (const c of candidates) {
    const res = await releaseEscrowHold({
      holdId: c.id,
      reason: "auto_release_72h",
    }).catch((e) => {
      console.warn(`[cron/auto-release-escrow] release ${c.id} failed:`, e);
      return null;
    });
    if (!res) {
      skipped++;
      continue;
    }
    if (res.released) {
      released++;
      void notifyEscrowReleasedToShop({
        shopOwnerUserId: c.order.shop.ownerId,
        orderToken: c.order.publicToken,
        amountSatang: c.amountSatang,
        reason: "auto_release_72h",
      }).catch(() => undefined);
    } else {
      skipped++;
    }
  }

  return ok({
    scanned: candidates.length,
    released,
    skipped,
    runAt: now.toISOString(),
  });
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (request.headers.get("x-vercel-cron-signature")) return true;
  return false;
}
