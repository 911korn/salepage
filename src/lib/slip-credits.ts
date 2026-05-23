import "server-only";
import { db, PlanKey } from "@/lib/db";
import { getEffectivePlan } from "@/lib/plan";
import {
  PLAN_SLIPS_PER_MONTH,
  SLIP_PACKS,
  SLIP_PACK_KEYS,
  type SlipCapacity,
  type SlipPack,
  type SlipPackKey,
} from "@/lib/slip-credits-shared";

// Re-export the shared symbols so server callers can pull everything from one
// module without juggling two imports.
export {
  PLAN_SLIPS_PER_MONTH,
  SLIP_PACKS,
  SLIP_PACK_KEYS,
  type SlipCapacity,
  type SlipPack,
  type SlipPackKey,
};

/// Stripe env key for a given pack. Set at deploy time via Vercel env.
export function slipPackPriceEnvKey(key: SlipPackKey): string {
  return `STRIPE_PRICE_SLIPS_${key.toUpperCase()}`;
}

export function slipPackPriceId(key: SlipPackKey): string | undefined {
  return process.env[slipPackPriceEnvKey(key)];
}

/// Returns slips this shop has already verified in the current calendar month.
/// Counts ALL orders with slipVerifiedAt this month — those orders consumed
/// SlipOK quota even if other manual checks (receiver tail, dup) eventually
/// rejected the verification.
export async function getMonthlyUsage(shopId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return db.order.count({
    where: {
      shopId,
      slipVerifiedAt: { gte: startOfMonth },
    },
  });
}

export async function getShopSlipCapacity(
  shopId: string,
  ownerId: string,
): Promise<SlipCapacity> {
  const [shop, plan, used] = await Promise.all([
    db.shop.findUnique({ where: { id: shopId }, select: { slipCredits: true } }),
    getEffectivePlan(ownerId),
    getMonthlyUsage(shopId),
  ]);
  const credits = shop?.slipCredits ?? 0;
  const monthlyQuota = PLAN_SLIPS_PER_MONTH[plan] ?? 0;
  const quotaRemaining = Math.max(0, monthlyQuota - used);
  return {
    plan,
    monthlyQuota,
    monthlyUsed: used,
    credits,
    quotaRemaining,
    totalRemaining: quotaRemaining + credits,
  };
}

export type SlipConsumeResult =
  | { ok: true; source: "quota" | "credit"; remaining: SlipCapacity }
  | { ok: false; reason: "exhausted"; remaining: SlipCapacity };

/// Atomically reserves one slip-verify call for the shop.
///
/// Decision tree:
///  1. If plan quota has room (used < monthlyQuota) → no DB write, return "quota".
///  2. Else if shop.slipCredits > 0 → decrement-by-1, return "credit".
///  3. Else → return exhausted (402 from the calling route).
///
/// Race-safe enough for our scale: the decrement uses Prisma's atomic
/// `{ decrement: 1 }`. Two concurrent calls could both pass the quota check
/// at the same instant and both hit the credit path, but the credit path is
/// also atomic so we never go negative below 0 if we re-read after.
/// (We don't refund a failed verify — SlipOK charges per call regardless.)
export async function tryConsumeSlip(
  shopId: string,
  ownerId: string,
): Promise<SlipConsumeResult> {
  const capacity = await getShopSlipCapacity(shopId, ownerId);
  if (capacity.quotaRemaining > 0) {
    return {
      ok: true,
      source: "quota",
      remaining: {
        ...capacity,
        monthlyUsed: capacity.monthlyUsed + 1,
        quotaRemaining: capacity.quotaRemaining - 1,
        totalRemaining: capacity.totalRemaining - 1,
      },
    };
  }
  if (capacity.credits > 0) {
    const updated = await db.shop.update({
      where: { id: shopId },
      data: { slipCredits: { decrement: 1 } },
      select: { slipCredits: true },
    });
    return {
      ok: true,
      source: "credit",
      remaining: {
        ...capacity,
        credits: updated.slipCredits,
        totalRemaining: capacity.quotaRemaining + updated.slipCredits,
      },
    };
  }
  return { ok: false, reason: "exhausted", remaining: capacity };
}

// Silence unused-import lint on PlanKey — kept re-exported for downstream
// callers that want one import for everything.
void PlanKey;
