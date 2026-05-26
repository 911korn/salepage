import { View, Text } from "react-native";

/**
 * Verified shop checkmark + tier label.
 *
 * Used inline next to shop names everywhere they appear (feed cards, shop
 * header, search results). The `compact` variant drops the tier label and
 * just shows the checkmark — useful for tight grid cards.
 */
export type KycStatus = "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";

interface VerifiedBadgeProps {
  kycStatus: KycStatus;
  compact?: boolean;
}

export function VerifiedBadge({ kycStatus, compact = false }: VerifiedBadgeProps) {
  if (kycStatus !== "VERIFIED") return null;

  if (compact) {
    return (
      <View className="size-4 items-center justify-center rounded-full bg-brand-600">
        <Text className="text-[8px] font-bold text-white">✓</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5">
      <View className="size-3.5 items-center justify-center rounded-full bg-brand-600">
        <Text className="text-[8px] font-bold text-white">✓</Text>
      </View>
      <Text className="text-[10px] font-semibold text-brand-700">ยืนยันตัวตน</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Trust Meter — 0–100 score with tiered color + label

export type TrustTier = "high" | "good" | "new" | "risk";

export function trustTier(score: number): TrustTier {
  if (score >= 85) return "high";
  if (score >= 65) return "good";
  if (score >= 40) return "new";
  return "risk";
}

const TIER_LABELS: Record<TrustTier, string> = {
  high: "ร้านน่าเชื่อถือสูง",
  good: "ร้านน่าเชื่อถือ",
  new: "ร้านใหม่",
  risk: "โปรดระวัง",
};

const TIER_COLORS: Record<TrustTier, { bar: string; text: string; bg: string }> = {
  high: { bar: "bg-emerald-600", text: "text-emerald-700", bg: "bg-emerald-50" },
  good: { bar: "bg-brand-600", text: "text-brand-700", bg: "bg-brand-50" },
  new: { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  risk: { bar: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50" },
};

interface TrustMeterProps {
  /** 0..100 — clamped before render. */
  score: number;
  /**
   * Variant:
   *  - "full":  bar + label + numeric — used on shop screen.
   *  - "pill":  pill chip with label only — used on feed cards.
   */
  variant?: "full" | "pill";
}

export function TrustMeter({ score, variant = "full" }: TrustMeterProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const tier = trustTier(clamped);
  const colors = TIER_COLORS[tier];
  const label = TIER_LABELS[tier];

  if (variant === "pill") {
    return (
      <View className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 ${colors.bg}`}>
        <View className={`size-1.5 rounded-full ${colors.bar}`} />
        <Text className={`text-[10px] font-semibold ${colors.text}`}>{label}</Text>
      </View>
    );
  }

  return (
    <View className={`rounded-2xl border border-border ${colors.bg} px-3 py-2.5`}>
      <View className="flex-row items-center justify-between">
        <Text className={`text-[12px] font-semibold ${colors.text}`}>{label}</Text>
        <Text className={`text-[14px] font-bold ${colors.text}`}>{clamped}/100</Text>
      </View>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
        <View
          className={`h-full ${colors.bar}`}
          style={{ width: `${clamped}%` }}
        />
      </View>
    </View>
  );
}

/**
 * Risk warning banner for new shops (score < 40 OR not verified + < 30 days old).
 * Optional UI element to surface near checkout / shop header to nudge buyers
 * toward verified shops without being too pushy.
 */
export function RiskWarning({ message }: { message: string }) {
  return (
    <View className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <Text className="text-[12px] font-semibold text-amber-900">⚠️ ข้อควรระวัง</Text>
      <Text className="mt-1 text-[12px] text-amber-800">{message}</Text>
    </View>
  );
}
