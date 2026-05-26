import "server-only";
import { db, OrderStatus } from "@/lib/db";
import type { KycStatus } from "@/generated/prisma";

/**
 * Trust Score (0–100) — surfaced on shop screens, feed cards, search results.
 *
 * Why a single composite score: buyers don't read multiple metrics. We bucket
 * the resulting number into tiers in the UI:
 *   85+  → "ร้านน่าเชื่อถือสูง" (green)
 *   65+  → "ร้านน่าเชื่อถือ"     (default)
 *   40+  → "ร้านใหม่"           (yellow — caution)
 *   <40  → "ระวัง"              (red banner)
 *
 * Components (all clamped before sum, then clamped to [0..100]):
 *   Base                 50
 *   KYC verified        +25
 *   Age 30–180 days      +5    (0 if newer than 30 days)
 *   Age 180+ days       +10
 *   Rating              +rating × 4   (5★ → +20, 0★ → 0)
 *   Sales volume        +min(15, totalSold / 100)   (1500 sold maxes out)
 *   Cancellation > 5%   −20    (skipped if no settled orders)
 *   Status PAUSED       −15
 *   Suspended           −50
 *
 * The function is **pure** — pass in everything it needs. The DB-aware wrapper
 * `recomputeTrustScore(shopId)` reads the shop + order stats and writes back.
 */
export interface TrustInputs {
  kycStatus: KycStatus;
  rating: number; // 0..5
  totalSold: number; // lifetime units sold
  createdAt: Date;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  suspended: boolean;
  /** Settled orders (PAID|SHIPPING|DELIVERED|CANCELLED|REFUNDED). */
  settledOrderCount: number;
  /** Of those settled orders, count of CANCELLED + REFUNDED. */
  cancelledOrderCount: number;
}

export function computeTrustScore(input: TrustInputs): number {
  let score = 50;

  if (input.kycStatus === "VERIFIED") score += 25;
  else if (input.kycStatus === "PENDING") score += 5;

  const ageDays = Math.floor(
    (Date.now() - input.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (ageDays >= 180) score += 10;
  else if (ageDays >= 30) score += 5;

  // Rating contribution — clamp inputs to defend against bad data
  const rating = Math.max(0, Math.min(5, input.rating));
  score += Math.round(rating * 4);

  // Volume contribution — capped so a single hot product doesn't dominate
  score += Math.min(15, Math.floor(Math.max(0, input.totalSold) / 100));

  // Penalty: high cancellation / refund rate
  if (input.settledOrderCount >= 10) {
    const cancelRate = input.cancelledOrderCount / input.settledOrderCount;
    if (cancelRate > 0.05) score -= 20;
  }

  if (input.status === "PAUSED") score -= 15;
  if (input.suspended) score -= 50;

  return Math.max(0, Math.min(100, score));
}

/**
 * UI tier — single source of truth so badge color + label can both branch on it.
 */
export type TrustTier = "high" | "good" | "new" | "risk";

export function trustTier(score: number): TrustTier {
  if (score >= 85) return "high";
  if (score >= 65) return "good";
  if (score >= 40) return "new";
  return "risk";
}

/**
 * Recompute and persist the trust score for a shop. Idempotent.
 *
 * Call sites (V1.5):
 *  - After review created/updated (rating shifts) — see `/api/v1/reviews/*`
 *  - After order DELIVERED or CANCELLED (volume + cancel rate)
 *  - After admin sets `kycStatus` to VERIFIED/REJECTED
 *  - Nightly cron sweeping aged-out PAID orders (V1.6+)
 */
export async function recomputeTrustScore(shopId: string): Promise<number> {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      kycStatus: true,
      rating: true,
      totalSold: true,
      createdAt: true,
      status: true,
      suspended: true,
    },
  });
  if (!shop) return 50;

  // Order rollup — single round-trip via groupBy
  const settled: OrderStatus[] = [
    OrderStatus.PAID,
    OrderStatus.SHIPPING,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ];
  const groups = await db.order.groupBy({
    by: ["status"],
    where: { shopId, status: { in: settled } },
    _count: { _all: true },
  });
  let total = 0;
  let cancelled = 0;
  for (const g of groups) {
    total += g._count._all;
    if (g.status === OrderStatus.CANCELLED || g.status === OrderStatus.REFUNDED) {
      cancelled += g._count._all;
    }
  }

  const score = computeTrustScore({
    kycStatus: shop.kycStatus,
    rating: shop.rating,
    totalSold: shop.totalSold,
    createdAt: shop.createdAt,
    status: shop.status,
    suspended: shop.suspended,
    settledOrderCount: total,
    cancelledOrderCount: cancelled,
  });

  await db.shop.update({
    where: { id: shopId },
    data: { trustScore: score, trustComputedAt: new Date() },
  });
  return score;
}
