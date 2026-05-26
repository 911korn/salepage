import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/api";
import { formatBaht } from "@/lib/format";

/**
 * Coupon + Loyalty panel — V1.5 cart addon.
 *
 * Lives below the cart's address form and only renders for single-shop bags
 * (multi-shop coupons are deferred per the multi-order route's V1.0 scope).
 *
 * Two independent rows:
 *  1. Coupon code: text input → POST /coupons/redeem to validate; show the
 *     server-calculated discount; allow clearing.
 *  2. Loyalty points: only shown when the buyer has typed a phone (we need
 *     it to look up the wallet). Slider-like buttons (-/max/+) to pick how
 *     many points to burn, capped at the wallet balance.
 *
 * The actual discount is applied server-side on order create; we only
 * preview the math here so the buyer sees real numbers.
 */
interface AppliedCoupon {
  code: string;
  discountSatang: number;
}

interface Props {
  shopSlug: string;
  phone: string;
  subtotalSatang: number;
  appliedCoupon: AppliedCoupon | null;
  couponInput: string;
  redeemPoints: number;
  onCouponInputChange: (v: string) => void;
  onApplyCoupon: (c: AppliedCoupon | null) => void;
  onRedeemPointsChange: (n: number) => void;
}

export function CouponLoyaltyPanel({
  shopSlug,
  phone,
  subtotalSatang,
  appliedCoupon,
  couponInput,
  redeemPoints,
  onCouponInputChange,
  onApplyCoupon,
  onRedeemPointsChange,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  // Coupon redeem mutation — keeps the UI honest about server validation.
  const redeemMutation = useMutation({
    mutationFn: () =>
      api.shops.redeemCoupon(shopSlug, {
        code: couponInput.trim(),
        subtotalSatang,
      }),
    onSuccess: (res) => {
      setError(null);
      onApplyCoupon({ code: res.code, discountSatang: res.discountSatang });
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "ใส่รหัสไม่ถูกต้อง";
      setError(msg);
      onApplyCoupon(null);
    },
  });

  // Loyalty wallet — only fetched once we have a valid 9-10 digit phone.
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const hasPhone = cleanPhone.length >= 9;
  const loyaltyQuery = useQuery({
    queryKey: ["loyalty", shopSlug, cleanPhone],
    queryFn: () => api.shops.loyalty(shopSlug, cleanPhone),
    enabled: hasPhone,
    staleTime: 30_000,
  });

  // Max points the buyer can redeem: capped at wallet balance AND at the
  // subtotal (each point = 1 baht = 100 satang for the simple model).
  const walletPoints = loyaltyQuery.data?.points ?? 0;
  const maxRedeemableBySubtotal = Math.floor(subtotalSatang / 100);
  const maxPoints = Math.min(walletPoints, maxRedeemableBySubtotal);

  return (
    <View className="mx-5 mt-4 gap-3 rounded-3xl border border-border bg-white p-5">
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        คูปอง + แต้มสะสม
      </Text>

      {/* Coupon row */}
      <View className="gap-1.5">
        <Text className="text-[12px] text-muted">รหัสคูปอง</Text>
        {appliedCoupon ? (
          <View className="flex-row items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <Text className="text-[16px]">🎟</Text>
            <View className="flex-1">
              <Text
                className="text-[13px] font-semibold uppercase text-emerald-900"
                numberOfLines={1}
              >
                {appliedCoupon.code}
              </Text>
              <Text className="text-[11px] text-emerald-700">
                ส่วนลด {formatBaht(appliedCoupon.discountSatang)}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                onApplyCoupon(null);
                onCouponInputChange("");
                setError(null);
              }}
              hitSlop={8}
            >
              <Text className="text-[12px] font-semibold text-emerald-700">
                ลบ
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            <TextInput
              value={couponInput}
              onChangeText={(v: string) => {
                onCouponInputChange(v.toUpperCase().replace(/\s/g, ""));
                setError(null);
              }}
              placeholder="ใส่รหัสคูปอง"
              autoCapitalize="characters"
              autoCorrect={false}
              className="flex-1 rounded-2xl border border-border bg-soft px-3 py-2.5 text-[14px] text-fg"
            />
            <Pressable
              onPress={() => {
                if (!couponInput.trim()) return;
                redeemMutation.mutate();
              }}
              disabled={redeemMutation.isPending || !couponInput.trim()}
              className={`rounded-2xl px-4 py-2.5 ${
                couponInput.trim()
                  ? "bg-brand-600"
                  : "bg-zinc-200"
              }`}
            >
              {redeemMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-[13px] font-semibold text-white">
                  ใช้
                </Text>
              )}
            </Pressable>
          </View>
        )}
        {error ? (
          <Text className="text-[11px] text-rose-600">{error}</Text>
        ) : null}
      </View>

      {/* Loyalty row */}
      <View className="gap-1.5 border-t border-border pt-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-[12px] text-muted">แต้มสะสม</Text>
          {hasPhone && loyaltyQuery.data ? (
            <Text className="text-[11px] font-semibold text-brand-700">
              คุณมี {walletPoints} pt
            </Text>
          ) : null}
        </View>

        {!hasPhone ? (
          <Text className="text-[11px] text-muted">
            ใส่เบอร์โทรด้านบนเพื่อดูแต้มของคุณ
          </Text>
        ) : loyaltyQuery.isLoading ? (
          <ActivityIndicator color="#e11d48" />
        ) : walletPoints === 0 ? (
          <Text className="text-[11px] text-muted">
            ยังไม่มีแต้มในร้านนี้ — แต้มจะสะสมหลังคำสั่งซื้อแรก
          </Text>
        ) : (
          <View className="gap-2">
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() =>
                  onRedeemPointsChange(Math.max(0, redeemPoints - 10))
                }
                className="size-9 items-center justify-center rounded-full bg-soft"
              >
                <Text className="text-[16px] font-bold text-fg">−</Text>
              </Pressable>
              <View className="flex-1 items-center">
                <Text className="text-[18px] font-bold text-brand-700">
                  {redeemPoints} pt
                </Text>
                <Text className="text-[10px] text-muted">
                  = ลด {formatBaht(redeemPoints * 100)}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  onRedeemPointsChange(Math.min(maxPoints, redeemPoints + 10))
                }
                className="size-9 items-center justify-center rounded-full bg-soft"
              >
                <Text className="text-[16px] font-bold text-fg">+</Text>
              </Pressable>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => onRedeemPointsChange(0)}
                className="flex-1 rounded-xl border border-border bg-white py-1.5"
              >
                <Text className="text-center text-[11px] font-medium text-fg">
                  0
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  onRedeemPointsChange(Math.floor(maxPoints / 2))
                }
                className="flex-1 rounded-xl border border-border bg-white py-1.5"
              >
                <Text className="text-center text-[11px] font-medium text-fg">
                  ครึ่งหนึ่ง
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onRedeemPointsChange(maxPoints)}
                className="flex-1 rounded-xl border border-brand-300 bg-brand-50 py-1.5"
              >
                <Text className="text-center text-[11px] font-semibold text-brand-700">
                  ใช้สูงสุด ({maxPoints})
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
