import type { PlanKey } from "@/generated/prisma";

/// Monthly slip-verify quota per plan tier. Hits the SlipOK quota whether
/// the verify succeeds or fails (log:false mode is charged regardless of
/// receiver match — see src/lib/slip-verify.ts). Used + credits combined
/// give the shop's effective monthly capacity.
export const PLAN_SLIPS_PER_MONTH: Record<PlanKey, number> = {
  FREE: 0,
  STARTER: 0,
  PRO: 300,
  BUSINESS: 1500,
  AGENCY: 10000,
};

/// AI slip credit packs sold as one-time top-ups. Stripe price IDs are
/// loaded from env at runtime (STRIPE_PRICE_SLIPS_<KEY>).
///
/// Keep slug + slips + price-baht in sync with the pricing-page display:
/// see src/components/landing/pricing.tsx → CREDIT_PACKS.
export interface SlipPack {
  key: SlipPackKey;
  slips: number;
  priceBaht: number;
  /// THB per slip — purely for display (= priceBaht / slips, rounded down).
  perSlipBaht: number;
}

export type SlipPackKey = "p50" | "p150" | "p500" | "p1500" | "p5000";

export const SLIP_PACKS: Record<SlipPackKey, SlipPack> = {
  p50: { key: "p50", slips: 50, priceBaht: 49, perSlipBaht: 0.98 },
  p150: { key: "p150", slips: 150, priceBaht: 129, perSlipBaht: 0.86 },
  p500: { key: "p500", slips: 500, priceBaht: 399, perSlipBaht: 0.8 },
  p1500: { key: "p1500", slips: 1500, priceBaht: 990, perSlipBaht: 0.66 },
  p5000: { key: "p5000", slips: 5000, priceBaht: 2900, perSlipBaht: 0.58 },
};

export const SLIP_PACK_KEYS = Object.keys(SLIP_PACKS) as SlipPackKey[];

export interface SlipCapacity {
  plan: PlanKey;
  monthlyQuota: number;
  monthlyUsed: number;
  credits: number;
  /// monthlyQuota - monthlyUsed (never negative)
  quotaRemaining: number;
  /// quotaRemaining + credits
  totalRemaining: number;
}
