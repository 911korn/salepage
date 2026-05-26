import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { TabBar } from "@/components/ui/tab-bar";
import { VerifiedBadge, TrustMeter } from "@/components/trust-badge";
import { StoriesRail } from "@/components/stories-rail";
import { DiscoveryRails } from "@/components/discovery-rails";
import { LiveRail } from "@/components/live-rail";
import { api } from "@/lib/api";
import type { ShopSummary } from "@/types/api";

type Tab = "for-you" | "new" | "following";

const CATEGORIES: Array<{ key: string; label: string; emoji: string }> = [
  { key: "fashion", label: "แฟชั่น", emoji: "👗" },
  { key: "food", label: "อาหาร", emoji: "🍜" },
  { key: "tech", label: "เทคโนโลยี", emoji: "📱" },
  { key: "beauty", label: "ความงาม", emoji: "💄" },
  { key: "health", label: "สุขภาพ", emoji: "💊" },
  { key: "furniture", label: "เฟอร์นิเจอร์", emoji: "🛋" },
  { key: "pets", label: "สัตว์เลี้ยง", emoji: "🐱" },
  { key: "books", label: "หนังสือ", emoji: "📚" },
  { key: "sport", label: "กีฬา", emoji: "⚽" },
  { key: "other", label: "อื่นๆ", emoji: "✨" },
];

/**
 * Discover feed (V1.0 home).
 *
 * Three tabs: For You / New / Following. Categories rail under the header.
 * Tap a shop card to open `/s/[slug]`.
 *
 * The old V0.5 launcher (slug input / track-by-token) was moved into the
 * profile tab as a power-user shortcut.
 */
export default function DiscoverScreen() {
  const [tab, setTab] = useState<Tab>("for-you");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // V1.5: "Verified only" toggle. Sticky-default OFF so unverified shops still
  // get exposure on the For-You tab — they need surface area to build trust.
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Infinite feed — React Query manages pages keyed by cursor. Pull-to-
  // refresh resets the pages; near-bottom-of-scroll triggers fetchNextPage.
  const feedQuery = useInfiniteQuery({
    queryKey: ["feed", tab, selectedCategory, verifiedOnly],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.feed.list({
        tab,
        category: selectedCategory ?? undefined,
        verified: verifiedOnly || undefined,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // Flatten paginated shops into a single list for rendering.
  const allShops = feedQuery.data?.pages.flatMap((p) => p.shops) ?? [];

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    // Trigger next page when within 600px of the bottom — generous buffer
    // so the user rarely hits an empty state mid-scroll.
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (
      distanceFromBottom < 600 &&
      feedQuery.hasNextPage &&
      !feedQuery.isFetchingNextPage
    ) {
      void feedQuery.fetchNextPage();
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-32"
        refreshControl={
          <RefreshControl
            refreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
            onRefresh={() => void feedQuery.refetch()}
            tintColor="#e11d48"
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={120}
      >
        {/* Header */}
        <View className="px-5 pt-10 pb-2">
          <Text className="text-[24px] font-bold tracking-tight text-fg">
            Sale<Text className="text-brand-600">Page</Text>
          </Text>
          <Text className="mt-0.5 text-[13px] text-muted">
            ร้านที่จ่ายตรง — ของถูกกว่า ไม่หัก%
          </Text>
        </View>

        {/* Tab strip + Verified toggle */}
        <View className="mt-3 flex-row items-center gap-2 px-5">
          {(["for-you", "new", "following"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className={`rounded-full px-3.5 py-1.5 ${
                tab === t ? "bg-brand-600" : "border border-border bg-white"
              }`}
            >
              <Text
                className={`text-[12px] font-semibold ${
                  tab === t ? "text-white" : "text-fg"
                }`}
              >
                {t === "for-you" ? "แนะนำ" : t === "new" ? "ใหม่" : "ติดตาม"}
              </Text>
            </Pressable>
          ))}
          {/* Verified-only filter — pushes to the right edge */}
          <Pressable
            onPress={() => setVerifiedOnly((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: verifiedOnly }}
            className={`ml-auto flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
              verifiedOnly
                ? "border border-emerald-300 bg-emerald-50"
                : "border border-border bg-white"
            }`}
          >
            <Text className={verifiedOnly ? "text-[11px]" : "text-[11px] opacity-50"}>
              ✓
            </Text>
            <Text
              className={`text-[11px] font-semibold ${
                verifiedOnly ? "text-emerald-700" : "text-muted"
              }`}
            >
              ยืนยันแล้ว
            </Text>
          </Pressable>
        </View>

        {/* V2 Stories rail — only renders if any shop has active stories */}
        <StoriesRail />

        {/* V2 Live shopping rail — self-hides when nothing is live */}
        <LiveRail />

        {/* V1.0 Featured shops + Flash Sale rails (curated picks above main feed) */}
        <DiscoveryRails />

        {/* Categories rail */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-5 py-4 gap-3"
        >
          <CategoryChip
            emoji="🌟"
            label="ทั้งหมด"
            active={selectedCategory === null}
            onPress={() => setSelectedCategory(null)}
          />
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.key}
              emoji={c.emoji}
              label={c.label}
              active={selectedCategory === c.key}
              onPress={() => setSelectedCategory(c.key)}
            />
          ))}
        </ScrollView>

        {/* Feed */}
        {feedQuery.isLoading ? (
          <View className="py-16">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : feedQuery.error ? (
          <ErrorState error={feedQuery.error} />
        ) : allShops.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <View className="px-5 gap-3">
            {allShops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
            {/* Inline pagination indicator */}
            {feedQuery.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color="#e11d48" />
              </View>
            ) : !feedQuery.hasNextPage && allShops.length > 6 ? (
              <Text className="py-4 text-center text-[11px] text-muted">
                — ถึงท้ายรายการแล้ว —
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
      <TabBar active="discover" />
    </Screen>
  );
}

function CategoryChip({
  emoji,
  label,
  active,
  onPress,
}: {
  emoji: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`items-center justify-center rounded-2xl px-4 py-3 ${
        active ? "bg-brand-50 border border-brand-200" : "bg-white border border-border"
      }`}
    >
      <Text className="text-[18px]">{emoji}</Text>
      <Text
        className={`mt-1 text-[11px] ${active ? "font-semibold text-brand-700" : "text-fg"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ShopCard({ shop }: { shop: ShopSummary }) {
  return (
    <Pressable
      onPress={() => router.push(`/s/${shop.slug}`)}
      className="overflow-hidden rounded-3xl border border-border bg-white"
    >
      {/* Banner */}
      <View
        className="h-24 w-full"
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
      <View className="flex-row gap-3 p-4">
        <View
          className="-mt-10 size-14 items-center justify-center overflow-hidden rounded-2xl border-2 border-white"
          style={{ backgroundColor: shop.themeColor }}
        >
          {shop.logoUrl ? (
            <Image
              source={{ uri: shop.logoUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <Text className="text-xl font-bold text-white">
              {shop.logoText ?? shop.name.slice(0, 1)}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text className="text-[15px] font-semibold text-fg" numberOfLines={1}>
              {shop.name}
            </Text>
            <VerifiedBadge kycStatus={shop.kycStatus} compact />
          </View>
          {shop.description ? (
            <Text className="mt-0.5 text-[12px] text-muted" numberOfLines={2}>
              {shop.description}
            </Text>
          ) : null}
          <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <TrustMeter score={shop.trustScore} variant="pill" />
            {shop.rating > 0 ? (
              <Text className="text-[11px] text-muted">⭐ {shop.rating.toFixed(1)}</Text>
            ) : null}
            {shop.totalSold > 0 ? (
              <Text className="text-[11px] text-muted">
                ขายแล้ว {shop.totalSold.toLocaleString()}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const messages: Record<Tab, { title: string; sub: string }> = {
    "for-you": {
      title: "ยังไม่มีร้านในหมวดนี้",
      sub: "เลือกหมวดอื่น หรือดู ร้านใหม่",
    },
    new: {
      title: "ยังไม่มีร้านใหม่ในรอบ 30 วัน",
      sub: "ไปดูร้านยอดนิยมก่อนได้",
    },
    following: {
      title: "ยังไม่ได้ติดตามร้านไหน",
      sub: "เปิดร้านแล้วกด 'ติดตาม' เพื่อรับข่าวสาร",
    },
  };
  const m = messages[tab];
  return (
    <View className="mx-5 mt-6 rounded-3xl border border-dashed border-border bg-white p-8">
      <Text className="text-center text-[15px] font-semibold text-fg">{m.title}</Text>
      <Text className="mt-1 text-center text-[12px] text-muted">{m.sub}</Text>
    </View>
  );
}

function ErrorState({ error }: { error: unknown }) {
  return (
    <View className="mx-5 mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6">
      <Text className="text-center text-[14px] text-rose-700">
        โหลดไม่สำเร็จ — {error instanceof Error ? error.message : "ไม่ทราบสาเหตุ"}
      </Text>
    </View>
  );
}
