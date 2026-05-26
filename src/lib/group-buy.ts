/**
 * Group Buy helpers — shared between the join endpoint, the auto-fill cron,
 * the auto-refund cron, and the public detail endpoint.
 *
 * The tier-pricing model is:
 *   - `tiers` is an array of `{ minQty, priceSatang }`.
 *   - The winning tier at any moment is the one with the largest `minQty`
 *     that is still ≤ `currentQty`.
 *   - Empty `tiers` → fallback to `Product.priceSatang` (flat price).
 *
 * We validate tiers at create time:
 *   - All `minQty` are unique + monotonically increasing.
 *   - All `priceSatang` are monotonically decreasing (more qty = lower price).
 *   - First tier must have `minQty` ≤ campaign `minQty` so the campaign can
 *     reach the lowest tier in principle.
 */
export interface PriceTier {
  minQty: number;
  priceSatang: number;
}

export function parseTiers(raw: unknown): PriceTier[] {
  if (!Array.isArray(raw)) return [];
  const out: PriceTier[] = [];
  for (const t of raw) {
    if (
      typeof t === "object" &&
      t !== null &&
      "minQty" in t &&
      "priceSatang" in t &&
      typeof (t as PriceTier).minQty === "number" &&
      typeof (t as PriceTier).priceSatang === "number"
    ) {
      out.push({
        minQty: (t as PriceTier).minQty,
        priceSatang: (t as PriceTier).priceSatang,
      });
    }
  }
  return out.sort((a, b) => a.minQty - b.minQty);
}

export type ValidateTiersResult =
  | { ok: true; tiers: PriceTier[] }
  | { ok: false; reason: string };

export function validateTiers(
  raw: unknown,
  campaignMinQty: number,
  productPriceSatang: number,
): ValidateTiersResult {
  if (raw === undefined || raw === null) return { ok: true, tiers: [] };
  if (!Array.isArray(raw)) return { ok: false, reason: "tiers must be an array" };
  if (raw.length === 0) return { ok: true, tiers: [] };
  if (raw.length > 5)
    return { ok: false, reason: "maximum 5 tiers per campaign" };

  const tiers = parseTiers(raw);
  if (tiers.length !== raw.length)
    return { ok: false, reason: "tier rows must include minQty + priceSatang" };

  let prevQty = 0;
  let prevPrice = Infinity;
  for (const t of tiers) {
    if (t.minQty < 1) return { ok: false, reason: "tier minQty must be >= 1" };
    if (t.priceSatang < 1)
      return { ok: false, reason: "tier priceSatang must be >= 1" };
    if (t.minQty <= prevQty)
      return { ok: false, reason: "tier minQty must strictly increase" };
    if (t.priceSatang >= prevPrice)
      return { ok: false, reason: "tier priceSatang must strictly decrease" };
    if (t.priceSatang > productPriceSatang)
      return {
        ok: false,
        reason: "tier priceSatang cannot exceed product price",
      };
    prevQty = t.minQty;
    prevPrice = t.priceSatang;
  }

  if (tiers[0]!.minQty > campaignMinQty)
    return {
      ok: false,
      reason: "first tier minQty must be ≤ campaign minQty",
    };
  return { ok: true, tiers };
}

/**
 * Compute the per-unit price the buyer locks in when they JOIN. We use
 * `currentQtyAtJoin` as a hint but ALWAYS lock to the lowest tier the
 * campaign has reached so far — buyers who join early aren't penalized
 * relative to later joiners.
 *
 * On FILL, the cron re-locks every member's price down to the final tier
 * (so everyone pays the same final-tier price) if `policy="final-tier"`.
 * V2.0 ships with the simpler "join-time" model — tiers act as a public
 * countdown, not a final-share split.
 */
export function priceForCurrentQty(
  tiers: PriceTier[],
  fallbackSatang: number,
  currentQty: number,
): number {
  if (tiers.length === 0) return fallbackSatang;
  let priceSatang = fallbackSatang;
  for (const t of tiers) {
    if (currentQty >= t.minQty) priceSatang = t.priceSatang;
    else break;
  }
  return priceSatang;
}
