import "server-only";
import { db, OrderStatus, PlanKey, SubscriptionStatus } from "@/lib/db";

/**
 * Server-side revenue forecast + business-plan data helpers, used by
 * the `/admin/business-plan` super-admin page. Centralised here so the
 * page itself stays focused on presentation, and the same numbers can
 * be exposed via a future API/CSV export without rewriting the queries.
 *
 * 911korn 2026-05-28 "ทำหน้าเมนู Business Plan ไว้ที่หลังบ้าน Super
 * Admin ให้หน่อย · forecast รายได้ และ แผนธุรกิจ".
 */

/**
 * Monthly subscription price in THB per plan tier. Source of truth is
 * Stripe — these numbers are kept in sync with the marketing pricing
 * page and the in-product upgrade modal. Update here when Stripe
 * prices change so the MRR math doesn't silently drift.
 */
export const PLAN_PRICE_BAHT: Record<PlanKey, number> = {
  FREE: 0,
  STARTER: 0,
  PRO: 299,
  BUSINESS: 790,
  AGENCY: 2490,
};

/** SalePage cost per slip-verify call from SlipOK. The cost is shared
 *  with the seller 50/50 (per pricing decision 2026-05-28) — sellers
 *  see ฿2.50/slip on the smallest pack down to ฿1.50/slip on the
 *  largest. This baseline cost drives the gross-margin math. */
const SLIPOK_COST_BAHT_PER_CALL = 5;

const PAID_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.SHIPPING,
  OrderStatus.DELIVERED,
];

const ACTIVE_SUB_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
];

export interface ForecastSnapshot {
  /** Total signed-up users (including those with no shop). */
  totalUsers: number;
  /** Total shops created (active OR draft). */
  totalShops: number;
  /** Shops that have at least one PAID order — the "live" merchant base. */
  liveShops: number;
  /** Shops created in the last 30 days. */
  newShops30d: number;
  /** Shops created in the last 7 days. */
  newShops7d: number;
  /** Sum of slipCredits across all shops — the "credit float" we've sold
   *  but haven't yet consumed (SlipOK calls). */
  unconsumedCreditFloat: number;

  /** Active subscriptions broken down by plan tier. Free/Starter omitted —
   *  they don't pay so don't contribute to MRR. */
  paidSubsByPlan: Record<PlanKey, number>;

  /** MRR in THB based on current paid subs only. Doesn't include slip-credit
   *  pack revenue (which is one-time, not recurring). */
  currentMrrBaht: number;

  /** GMV (gross merchandise value) flowing through the platform in the
   *  trailing 30 / 7 / 1 day windows. SalePage doesn't take a % cut, but
   *  GMV signals how serious the merchant base is. */
  gmv30dBaht: number;
  gmv7dBaht: number;
  gmv1dBaht: number;

  /** Total slip-verify calls in the last 30d — drives SlipOK cost. */
  slipCalls30d: number;

  /** % of shops that have a paid plan (Pro+). High = monetisation working. */
  paidConversionPct: number;

  /** Compound-monthly growth rate of shops, derived from the last 7d vs the
   *  prior 7d. Null when we don't have enough data. */
  shopGrowthCmgr: number | null;
}

/** Returns a synthetic snapshot for "what if we had N shops?" scenario
 *  planning. Keeps the real measured per-shop ratios (GMV/shop, slip
 *  calls/shop) from the live data and only swaps in the hypothetical
 *  shop count + scaled derived counts. Useful for the operator to plug
 *  in 5K / 10K / 50K and see the financial picture. 911korn 2026-05-28
 *  "ถ้า forecast มีสัก 5,000 ร้านค้า จะเป็นไง". */
export async function getForecastSnapshotWithShopOverride(
  shopCountOverride: number,
): Promise<ForecastSnapshot> {
  const real = await getForecastSnapshot();
  if (real.totalShops === 0) {
    // Live data empty — synthesise reasonable defaults so the page renders.
    return {
      ...real,
      totalShops: shopCountOverride,
      totalUsers: Math.round(shopCountOverride * 1.4),
      liveShops: Math.round(shopCountOverride * 0.65),
      newShops30d: Math.round(shopCountOverride * 0.18),
      newShops7d: Math.round(shopCountOverride * 0.045),
      gmv30dBaht: shopCountOverride * 2000,
      gmv7dBaht: shopCountOverride * 460,
      gmv1dBaht: shopCountOverride * 65,
      slipCalls30d: Math.round(shopCountOverride * 5),
      paidConversionPct: 5,
    };
  }
  // Scale every per-shop ratio that we observe in the real snapshot to
  // the hypothetical shop count.
  const scale = shopCountOverride / real.totalShops;
  return {
    ...real,
    totalShops: shopCountOverride,
    totalUsers: Math.round(real.totalUsers * scale),
    liveShops: Math.round(real.liveShops * scale),
    newShops30d: Math.round(real.newShops30d * scale),
    newShops7d: Math.round(real.newShops7d * scale),
    gmv30dBaht: Math.round(real.gmv30dBaht * scale),
    gmv7dBaht: Math.round(real.gmv7dBaht * scale),
    gmv1dBaht: Math.round(real.gmv1dBaht * scale),
    slipCalls30d: Math.round(real.slipCalls30d * scale),
    // paidSubsByPlan scales with shop count under the assumption that the
    // mix stays constant — useful as a "what if scale doubled" view.
    paidSubsByPlan: {
      FREE: Math.round(real.paidSubsByPlan.FREE * scale),
      STARTER: Math.round(real.paidSubsByPlan.STARTER * scale),
      PRO: Math.round(real.paidSubsByPlan.PRO * scale),
      BUSINESS: Math.round(real.paidSubsByPlan.BUSINESS * scale),
      AGENCY: Math.round(real.paidSubsByPlan.AGENCY * scale),
    },
    currentMrrBaht: Math.round(real.currentMrrBaht * scale),
  };
}

export async function getForecastSnapshot(): Promise<ForecastSnapshot> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const day7 = new Date(now);
  day7.setDate(day7.getDate() - 7);
  const day14 = new Date(now);
  day14.setDate(day14.getDate() - 14);
  const day30 = new Date(now);
  day30.setDate(day30.getDate() - 30);

  const [
    totalUsers,
    totalShops,
    liveShopRecords,
    newShops30d,
    newShops7d,
    newShops7to14d,
    creditAggregate,
    activeSubs,
    gmv30d,
    gmv7d,
    gmv1d,
    slipCalls30d,
  ] = await Promise.all([
    db.user.count(),
    db.shop.count(),
    db.order.groupBy({
      by: ["shopId"],
      where: { status: { in: PAID_STATUSES } },
    }),
    db.shop.count({ where: { createdAt: { gte: day30 } } }),
    db.shop.count({ where: { createdAt: { gte: day7 } } }),
    db.shop.count({
      where: { createdAt: { gte: day14, lt: day7 } },
    }),
    db.shop.aggregate({ _sum: { slipCredits: true } }),
    db.subscription.findMany({
      where: { status: { in: ACTIVE_SUB_STATUSES } },
      select: { plan: true },
    }),
    db.order.aggregate({
      where: { status: { in: PAID_STATUSES }, createdAt: { gte: day30 } },
      _sum: { totalSatang: true },
    }),
    db.order.aggregate({
      where: { status: { in: PAID_STATUSES }, createdAt: { gte: day7 } },
      _sum: { totalSatang: true },
    }),
    db.order.aggregate({
      where: { status: { in: PAID_STATUSES }, createdAt: { gte: startOfDay } },
      _sum: { totalSatang: true },
    }),
    db.order.count({
      where: { slipVerifiedAt: { gte: day30 } },
    }),
  ]);

  const liveShops = liveShopRecords.length;

  // Bucket subs by plan
  const paidSubsByPlan: Record<PlanKey, number> = {
    FREE: 0,
    STARTER: 0,
    PRO: 0,
    BUSINESS: 0,
    AGENCY: 0,
  };
  for (const s of activeSubs) paidSubsByPlan[s.plan]++;

  // MRR — only count plans that actually charge money. Free/Starter rows
  // can show up here when a seller is on a trial; their price is 0.
  const currentMrrBaht =
    paidSubsByPlan.PRO * PLAN_PRICE_BAHT.PRO +
    paidSubsByPlan.BUSINESS * PLAN_PRICE_BAHT.BUSINESS +
    paidSubsByPlan.AGENCY * PLAN_PRICE_BAHT.AGENCY;

  const paidShops =
    paidSubsByPlan.PRO + paidSubsByPlan.BUSINESS + paidSubsByPlan.AGENCY;
  const paidConversionPct = totalShops > 0 ? (paidShops / totalShops) * 100 : 0;

  // Compound-monthly growth rate inferred from 7d-vs-prior-7d shop adds.
  // (newShops7d / newShops7to14d) ^ (30/7) - 1 → projects current 7d
  // momentum forward a month. Bail if either base is too small to be
  // meaningful (< 3 shops) — extrapolation off tiny numbers is noise.
  let shopGrowthCmgr: number | null = null;
  if (newShops7d >= 3 && newShops7to14d >= 3) {
    const wow = newShops7d / newShops7to14d;
    shopGrowthCmgr = Math.pow(wow, 30 / 7) - 1;
  }

  return {
    totalUsers,
    totalShops,
    liveShops,
    newShops30d,
    newShops7d,
    unconsumedCreditFloat: creditAggregate._sum.slipCredits ?? 0,
    paidSubsByPlan,
    currentMrrBaht,
    gmv30dBaht: ((gmv30d._sum.totalSatang ?? 0) as number) / 100,
    gmv7dBaht: ((gmv7d._sum.totalSatang ?? 0) as number) / 100,
    gmv1dBaht: ((gmv1d._sum.totalSatang ?? 0) as number) / 100,
    slipCalls30d,
    paidConversionPct,
    shopGrowthCmgr,
  };
}

export interface ForecastScenario {
  label: string;
  /** Monthly growth multiplier — 0.10 means "shops grow 10% / month". */
  monthlyGrowth: number;
  /** What fraction of total shops are on paid plans by month 12. */
  paidConversionAtM12: number;
  /** Average revenue per paid shop in baht (weighted across PRO/Business/Agency). */
  arpuBaht: number;
}

/** Three scenarios — pessimistic / realistic / optimistic. The realistic
 *  one is anchored to the snapshot's measured growth rate when available;
 *  the other two flank it ±50 % so the spread shows the cone of outcomes
 *  given current trajectory. */
export function buildScenarios(snapshot: ForecastSnapshot): ForecastScenario[] {
  // Default monthly growth if measured CMGR isn't available — anchor to
  // 15% which is a reasonable benchmark for a Thai SaaS in early growth.
  const measured = snapshot.shopGrowthCmgr ?? 0.15;
  const realisticGrowth = Math.max(0.05, Math.min(measured, 0.5));

  // ARPU = weighted average of plan prices. Until we have meaningful sub
  // numbers, hardcode a realistic mix: 70% Pro, 25% Business, 5% Agency.
  const arpu =
    0.7 * PLAN_PRICE_BAHT.PRO +
    0.25 * PLAN_PRICE_BAHT.BUSINESS +
    0.05 * PLAN_PRICE_BAHT.AGENCY;

  return [
    {
      label: "Pessimistic",
      monthlyGrowth: realisticGrowth * 0.5,
      paidConversionAtM12: 0.04,
      arpuBaht: arpu,
    },
    {
      label: "Realistic",
      monthlyGrowth: realisticGrowth,
      paidConversionAtM12: 0.08,
      arpuBaht: arpu,
    },
    {
      label: "Optimistic",
      monthlyGrowth: realisticGrowth * 1.5,
      paidConversionAtM12: 0.14,
      arpuBaht: arpu,
    },
  ];
}

export interface MonthlyProjection {
  /** 1-indexed — month 1 is "current month + 1". */
  month: number;
  shops: number;
  paidShops: number;
  mrrBaht: number;
  /** Cumulative slip-pack revenue ASSUMING 20% of paid shops buy one ฿330
   *  pack per month on average (a conservative middle of the pack tiers). */
  slipPackRevBaht: number;
  /** Total monthly revenue = MRR + slip-pack revenue + escrow fees. */
  totalRevenueBaht: number;
}

/** Project 12 months forward under one scenario. The conversion curve
 *  smoothly ramps from current paidConversionPct → paidConversionAtM12
 *  linearly over the 12-month window. */
export function project12Months(
  snapshot: ForecastSnapshot,
  scenario: ForecastScenario,
): MonthlyProjection[] {
  const startShops = snapshot.totalShops;
  const startConversion = snapshot.paidConversionPct / 100;
  const targetConversion = scenario.paidConversionAtM12;

  const out: MonthlyProjection[] = [];
  for (let m = 1; m <= 12; m++) {
    const shops = Math.round(
      startShops * Math.pow(1 + scenario.monthlyGrowth, m),
    );
    const conversion =
      startConversion + ((targetConversion - startConversion) * m) / 12;
    const paidShops = Math.round(shops * conversion);
    const mrrBaht = paidShops * scenario.arpuBaht;
    // Slip-pack revenue — 20% of paid shops buy a ฿330 pack monthly on
    // average. Conservative middle of the pricing tiers.
    const slipPackRevBaht = Math.round(paidShops * 0.2 * 330);
    // Escrow fee revenue — assume 8% of GMV uses escrow at 2% fee.
    // GMV scales with paid+free shops (free shops still trade). Use the
    // current month's GMV per shop as the baseline.
    const gmvPerShop = snapshot.gmv30dBaht / Math.max(1, snapshot.totalShops);
    const escrowFeeBaht = Math.round(shops * gmvPerShop * 0.08 * 0.02);
    const totalRevenueBaht = mrrBaht + slipPackRevBaht + escrowFeeBaht;
    out.push({
      month: m,
      shops,
      paidShops,
      mrrBaht: Math.round(mrrBaht),
      slipPackRevBaht,
      totalRevenueBaht,
    });
  }
  return out;
}

/** Estimated platform-wide costs that grow with usage. Used to derive
 *  contribution margin. */
export interface CostProjection {
  /** SlipOK API cost — ~5฿ per call. Sold to seller at 2.5฿ (FREE/Starter
   *  via packs) — so we eat 50% as a customer-acquisition subsidy. */
  slipOkCostBaht: number;
  /** Vercel compute + Blob — roughly scales with traffic. Anchor at ฿2/shop/mo
   *  based on current infrastructure mix; revise as we grow. */
  hostingBaht: number;
  /** Stripe fees — ~3.65 % of subscription + slip-pack revenue. */
  stripeFeesBaht: number;
}

export function projectCosts(
  projection: MonthlyProjection[],
  snapshot: ForecastSnapshot,
): CostProjection[] {
  const slipCallsPerShop =
    snapshot.totalShops > 0
      ? snapshot.slipCalls30d / snapshot.totalShops
      : 5; // ~5 slip calls/shop/month is the early-stage baseline
  return projection.map((p) => ({
    slipOkCostBaht: Math.round(
      p.shops * slipCallsPerShop * SLIPOK_COST_BAHT_PER_CALL * 0.5,
    ),
    hostingBaht: Math.round(p.shops * 2),
    stripeFeesBaht: Math.round((p.mrrBaht + p.slipPackRevBaht) * 0.0365),
  }));
}
