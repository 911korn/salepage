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

/// AI slip credit pricing — 911korn 2026-05-28 03:30 "เราขายถูกไปมาก
/// เพิ่มเป็น เริ่มต้นที่ 2.5 บาทต่อรายการ และ ถูกสุดที่ 1.5 บาท".
///
/// These prices are what the SELLER pays per slip after SalePage's
/// 50% subsidy ("ออกกันคนละครึ่ง"). The underlying SlipOK cost to
/// SalePage is ~5 ฿/slip via the log:false multi-tenant flow; we
/// cover half so sellers see 2.5 ฿ (smallest pack) down to 1.5 ฿
/// (largest pack). Per-slip and pack-price are kept consistent
/// across tiers — bigger packs = bigger discount on the per-slip
/// rate, same shape as before.
export const SLIP_PACKS: Record<SlipPackKey, SlipPack> = {
  p50:   { key: "p50",   slips: 50,   priceBaht: 125,  perSlipBaht: 2.50 },
  p150:  { key: "p150",  slips: 150,  priceBaht: 330,  perSlipBaht: 2.20 },
  p500:  { key: "p500",  slips: 500,  priceBaht: 950,  perSlipBaht: 1.90 },
  p1500: { key: "p1500", slips: 1500, priceBaht: 2550, perSlipBaht: 1.70 },
  p5000: { key: "p5000", slips: 5000, priceBaht: 7500, perSlipBaht: 1.50 },
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
