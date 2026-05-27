import { memo, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useLocalSearchParams, router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { VerifiedBadge, TrustMeter } from "@/components/trust-badge";
import { api } from "@/lib/api";
import type { ShopSummary } from "@/types/api";

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  fashion: { label: "แฟชั่น", emoji: "👗" },
  food: { label: "อาหาร", emoji: "🍜" },
  tech: { label: "เทคโนโลยี", emoji: "📱" },
  beauty: { label: "ความงาม", emoji: "💄" },
  health: { label: "สุขภาพ", emoji: "💊" },
  furniture: { label: "เฟอร์นิเจอร์", emoji: "🛋" },
  pets: { label: "สัตว์เลี้ยง", emoji: "🐱" },
  books: { label: "หนังสือ", emoji: "📚" },
  sport: { label: "กีฬา", emoji: "⚽" },
  other: { label: "อื่นๆ", emoji: "✨" },
};

/**
 * /c/[slug] — full-screen category landing page.
 *
 * Virtualised: FlatList of ShopCards (no nested ScrollView). With 50+
 * shops in a category the old ScrollView+.map() rendered the whole list
 * synchronously and never recycled.
 */
export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const meta = slug ? CATEGORY_LABELS[slug] : null;
  const label = meta?.label ?? slug ?? "หมวดหมู่";

  const feedQuery = useInfiniteQuery({
    queryKey: ["feed", "category", slug],
    enabled: Boolean(slug),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.feed.list({ category: slug, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const allShops = useMemo(
    () => feedQuery.data?.pages.flatMap((p) => p.shops) ?? [],
    [feedQuery.data],
  );

  const renderItem: ListRenderItem<ShopSummary> = useCallback(
    ({ item }) => <ShopCard shop={item} />,
    [],
  );

  const ListHeader = (
    <View className="px-5 pt-6 pb-3">
      <Text className="text-[36px]">{meta?.emoji ?? "🛍"}</Text>
      <Text className="mt-2 text-[24px] font-bold text-fg">{label}</Text>
      <Text className="mt-1 text-[12px] text-muted">ร้านค้าในหมวดนี้</Text>
    </View>
  );

  const ListFooter = feedQuery.isFetchingNextPage ? (
    <View className="py-4">
      <ActivityIndicator color="#e11d48" />
    </View>
  ) : !feedQuery.hasNextPage && allShops.length > 6 ? (
    <Text className="py-4 text-center text-[11px] text-muted">
      — ถึงท้ายรายการแล้ว —
    </Text>
  ) : null;

  return (
    <Screen>
      <FlashList
        data={allShops}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={
          feedQuery.isLoading ? (
            <View className="py-16">
              <ActivityIndicator color="#e11d48" />
            </View>
          ) : (
            <View className="mx-5 mt-6 rounded-3xl border border-dashed border-border bg-white p-8">
              <Text className="text-center text-[15px] font-semibold text-fg">
                ยังไม่มีร้านในหมวดนี้
              </Text>
              <Text className="mt-1 text-center text-[12px] text-muted">
                ลองหมวดอื่น หรือกลับไปดูทั้งหมด
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 64 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={
          <RefreshControl
            refreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
            onRefresh={() => void feedQuery.refetch()}
            tintColor="#e11d48"
          />
        }
        onEndReached={() => {
          if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            void feedQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const ShopCard = memo(function ShopCard({ shop }: { shop: ShopSummary }) {
  return (
    <Pressable
      onPress={() => router.push(`/s/${shop.slug}`)}
      className="overflow-hidden rounded-3xl border border-border bg-white"
    >
      <View
        className="h-24 w-full"
        style={{ backgroundColor: shop.themeColor }}
      >
        {shop.bannerUrls[0] ? (
          <Image
            source={{ uri: shop.bannerUrls[0] }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={`${shop.id}-banner`}
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
              cachePolicy="memory-disk"
              transition={150}
              recyclingKey={`${shop.id}-logo`}
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
          </View>
        </View>
      </View>
    </Pressable>
  );
});
