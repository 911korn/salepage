import { memo, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { api } from "@/lib/api";
import { VerifiedBadge } from "@/components/trust-badge";
import { formatBaht } from "@/lib/format";

/**
 * Combined home-feed rails: Featured shops carousel + Flash-sale coupons.
 *
 * Memoised so the feed's filter-state changes don't re-render the rail.
 */
export const DiscoveryRails = memo(function DiscoveryRails() {
  const railsQuery = useQuery({
    queryKey: ["discovery-rails"],
    queryFn: () => api.discovery.rails(),
    staleTime: 60_000,
  });

  if (!railsQuery.data) return null;
  const { featured, flashSale } = railsQuery.data;
  if (featured.length === 0 && flashSale.length === 0) return null;

  return (
    <View>
      {flashSale.length > 0 ? <FlashSaleRail items={flashSale} /> : null}
      {featured.length > 0 ? <FeaturedRail items={featured} /> : null}
    </View>
  );
});

type Featured = NonNullable<
  Awaited<ReturnType<typeof api.discovery.rails>>
>["featured"][number];

type FlashItem = NonNullable<
  Awaited<ReturnType<typeof api.discovery.rails>>
>["flashSale"][number];

function FeaturedRail({ items }: { items: Featured[] }) {
  return (
    <View className="mt-3">
      <View className="px-5">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          ⭐ Featured
        </Text>
        <Text className="mt-0.5 text-[14px] font-bold text-fg">
          ร้านแนะนำจากทีมงาน
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 py-3 gap-3"
      >
        {items.map((shop) => (
          <Pressable
            key={shop.id}
            onPress={() => router.push(`/s/${shop.slug}`)}
            className="w-44 overflow-hidden rounded-2xl border border-border bg-white"
          >
            <View
              className="h-20 w-full"
              style={{ backgroundColor: shop.themeColor }}
            >
              {shop.bannerUrls[0] ? (
                <Image
                  source={{ uri: shop.bannerUrls[0] }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : null}
            </View>
            <View className="p-3">
              <View className="flex-row items-center gap-1.5">
                <Text
                  className="text-[13px] font-semibold text-fg"
                  numberOfLines={1}
                >
                  {shop.name}
                </Text>
                <VerifiedBadge kycStatus={shop.kycStatus} compact />
              </View>
              {shop.totalSold > 0 ? (
                <Text className="mt-0.5 text-[10px] text-muted">
                  ขายแล้ว {shop.totalSold.toLocaleString()}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function FlashSaleRail({ items }: { items: FlashItem[] }) {
  return (
    <View className="mt-3">
      <View className="flex-row items-baseline justify-between px-5">
        <View>
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">
            ⚡ Flash Sale
          </Text>
          <Text className="mt-0.5 text-[14px] font-bold text-fg">
            ลดด่วน — เหลือเวลาอีกไม่นาน
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 py-3 gap-3"
      >
        {items.map((c) => (
          <FlashSaleCard key={c.id} coupon={c} />
        ))}
      </ScrollView>
    </View>
  );
}

function FlashSaleCard({ coupon }: { coupon: FlashItem }) {
  const remaining = useTimeRemaining(coupon.expiresAt);

  return (
    <Pressable
      onPress={() => router.push(`/s/${coupon.shop.slug}`)}
      className="w-44 overflow-hidden rounded-2xl border border-rose-200 bg-rose-50 p-3"
    >
      <View className="flex-row items-center gap-2">
        <View
          className="size-9 items-center justify-center overflow-hidden rounded-lg"
          style={{ backgroundColor: coupon.shop.themeColor }}
        >
          {coupon.shop.logoUrl ? (
            <Image
              source={{ uri: coupon.shop.logoUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <Text className="text-[12px] font-bold text-white">
              {coupon.shop.logoText ?? coupon.shop.name.slice(0, 1)}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <Text
            className="text-[11px] font-semibold text-fg"
            numberOfLines={1}
          >
            {coupon.shop.name}
          </Text>
          <Text className="text-[10px] text-muted">
            ⏰ {remaining}
          </Text>
        </View>
      </View>
      <Text className="mt-2 text-[18px] font-bold text-rose-700">
        {coupon.kind === "percent"
          ? `-${coupon.value}%`
          : `-${formatBaht(coupon.value)}`}
      </Text>
      <Text className="text-[10px] text-rose-600">โค้ด {coupon.code}</Text>
      {coupon.minOrderSatang ? (
        <Text className="text-[9px] text-rose-500">
          ขั้นต่ำ {formatBaht(coupon.minOrderSatang)}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Returns a Thai-friendly remaining-time string that ticks every minute.
 * Used by the flash-sale rail to give buyers a soft urgency nudge without
 * busy-rendering a full clock down to seconds.
 */
function useTimeRemaining(iso: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "หมดเวลา";
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 24) return `เหลืออีก ${Math.floor(hours / 24)} วัน`;
  if (hours > 0) return `เหลืออีก ${hours} ชม. ${mins} นาที`;
  return `เหลืออีก ${mins} นาที`;
}
