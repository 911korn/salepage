import { memo, useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  type ListRenderItem,
} from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/ui/screen";
import { VerifiedBadge } from "@/components/trust-badge";
import { StoriesRail } from "@/components/stories-rail";
import { DiscoveryRails } from "@/components/discovery-rails";
import { LiveRail } from "@/components/live-rail";
import { AppLogo } from "@/components/brand/app-logo";
import { Search } from "lucide-react-native";
import { api } from "@/lib/api";
import { formatBaht } from "@/lib/format";

// Category icons are Lucide line-art glyphs (no emojis — emojis make the
// app look amateurish per the CET "official logos / proper icons only" rule).
// Labels resolve through `common.categories.*` so a new locale just needs JSON.
import {
  Shirt,
  UtensilsCrossed,
  Smartphone,
  Sparkles,
  HeartPulse,
  Sofa,
  PawPrint,
  Book,
  Dumbbell,
  Box,
  Star,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

const CATEGORY_KEYS = [
  "fashion",
  "food",
  "tech",
  "beauty",
  "health",
  "furniture",
  "pets",
  "books",
  "sport",
  "other",
] as const;
const CATEGORY_ICONS: Record<(typeof CATEGORY_KEYS)[number], LucideIcon> = {
  fashion: Shirt,
  food: UtensilsCrossed,
  tech: Smartphone,
  beauty: Sparkles,
  health: HeartPulse,
  furniture: Sofa,
  pets: PawPrint,
  books: Book,
  sport: Dumbbell,
  other: Box,
};

type Sort = "relevance" | "sold" | "newest";

/**
 * Home tab (V1.1) — Shopee-style product grid. Two columns, each card shows
 * product image, name, price, and a small shop chip. Tapping the card opens
 * the product detail; tapping the shop chip opens the shop page.
 *
 * Above the grid: stories rail + live rail + flash sale rail + categories.
 * The shops-first discovery (the old home content) moved to the /search tab.
 */
export default function HomeScreen() {
  const { t } = useTranslation(["common", "home"]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("relevance");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const feedQuery = useInfiniteQuery({
    queryKey: ["products-feed", selectedCategory, sort, verifiedOnly],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.productsFeed.list({
        category: selectedCategory ?? undefined,
        sort,
        verified: verifiedOnly || undefined,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const allProducts = useMemo(
    () => feedQuery.data?.pages.flatMap((p) => p.products) ?? [],
    [feedQuery.data],
  );

  // Stable ref so FlatList doesn't re-build the header subtree on every
  // scroll tick. The filter chips read state via closure — that's fine,
  // it only re-renders when sort/verifiedOnly/selectedCategory change.
  const ListHeader = (
    <View>
      {/* Header — horizontal SalePage lockup */}
      <View className="px-5 pt-10 pb-2">
        <AppLogo size={28} hero />
        <Text className="mt-1.5 text-[13px] text-muted">{t("tagline")}</Text>
      </View>

      {/* Quick search bar — taps land in /search */}
      <Pressable
        onPress={() => router.push("/search")}
        className="mx-5 mt-3 flex-row items-center gap-2 rounded-full border border-border bg-white px-4 py-2.5"
      >
        <Search size={16} color="#737373" strokeWidth={2} />
        <Text className="flex-1 text-[13px] text-muted">
          {t("home:searchPlaceholder")}
        </Text>
      </Pressable>

      {/* Sort + verified toggle */}
      <View className="mt-3 flex-row items-center gap-2 px-5">
        {(
          [
            { key: "relevance", labelKey: "filters.recommended" },
            { key: "sold", labelKey: "filters.bestSelling" },
            { key: "newest", labelKey: "filters.newest" },
          ] as const
        ).map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSort(s.key)}
            className={`rounded-full px-3.5 py-1.5 ${
              sort === s.key ? "bg-brand-600" : "border border-border bg-white"
            }`}
          >
            <Text
              className={`text-[12px] font-semibold ${
                sort === s.key ? "text-white" : "text-fg"
              }`}
            >
              {t(s.labelKey)}
            </Text>
          </Pressable>
        ))}
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
            {t("filters.verified")}
          </Text>
        </Pressable>
      </View>

      {/* Above-the-fold rails (self-hide when empty) */}
      <StoriesRail />
      <LiveRail />
      <DiscoveryRails />

      {/* Categories rail */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 py-4 gap-3"
      >
        <CategoryChip
          Icon={Star}
          label={t("filters.all")}
          active={selectedCategory === null}
          onPress={() => setSelectedCategory(null)}
        />
        {CATEGORY_KEYS.map((key) => (
          <CategoryChip
            key={key}
            Icon={CATEGORY_ICONS[key]}
            label={t(`categories.${key}`)}
            active={selectedCategory === key}
            onPress={() => setSelectedCategory(key)}
          />
        ))}
      </ScrollView>
    </View>
  );

  const renderProduct: ListRenderItem<ProductFeedItem> = useCallback(
    ({ item }) => <ProductCard product={item} />,
    [],
  );

  const ListFooter = feedQuery.isFetchingNextPage ? (
    <View className="w-full py-4">
      <ActivityIndicator color="#e11d48" />
    </View>
  ) : !feedQuery.hasNextPage && allProducts.length > 8 ? (
    <Text className="w-full py-4 text-center text-[11px] text-muted">
      {t("states.endOfList")}
    </Text>
  ) : null;

  return (
    <Screen safeTop>
      <FlatList
        // Two-column product grid. numColumns is fixed (changing it
        // requires re-mounting which is fine since we re-key the
        // queryKey on filter change). We do NOT virtualise the rails
        // above the grid — those are short (3-10 items each) and the
        // ListHeader renders once.
        data={allProducts}
        numColumns={2}
        keyExtractor={keyExtractor}
        renderItem={renderProduct}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={
          feedQuery.isLoading ? (
            <View className="py-16">
              <ActivityIndicator color="#e11d48" />
            </View>
          ) : feedQuery.error ? (
            <ErrorState error={feedQuery.error} />
          ) : (
            <EmptyState category={selectedCategory} />
          )
        }
        columnWrapperStyle={{ paddingHorizontal: 12 }}
        contentContainerStyle={{ paddingBottom: 128 }}
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
        // Virtualisation tuning — 60 FPS scroll on iPhone SE with 100+
        // products. removeClippedSubviews drops off-screen cells from
        // the native view tree. initialNumToRender = first batch (5
        // rows = 10 cards). maxToRenderPerBatch controls how many cells
        // can render per frame after that.
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={11}
        updateCellsBatchingPeriod={50}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function keyExtractor(item: ProductFeedItem) {
  return item.id;
}

type ProductFeedItem = NonNullable<
  Awaited<ReturnType<typeof api.productsFeed.list>>
>["products"][number];

// React.memo prevents the card from re-rendering when its parent
// (the feed screen) updates state unrelated to this product. FlatList
// passes `item` by reference, so memo's default shallow compare is
// enough to skip cards whose product object didn't change.
const ProductCard = memo(function ProductCard({
  product,
}: {
  product: ProductFeedItem;
}) {
  // Memoise the discount math so we don't re-compute on every parent
  // re-render. With 60+ cards on screen this saves 60+ ops per render.
  const { hasDiscount, discountPct } = useMemo(() => {
    const has =
      product.compareAtSatang !== null &&
      product.compareAtSatang > product.priceSatang;
    return {
      hasDiscount: has,
      discountPct: has
        ? Math.round(
            ((product.compareAtSatang! - product.priceSatang) /
              product.compareAtSatang!) *
              100,
          )
        : 0,
    };
  }, [product.compareAtSatang, product.priceSatang]);

  return (
    <Pressable
      onPress={() => router.push(`/s/${product.shopSlug}/${product.slug}`)}
      className="m-1 w-[48%] overflow-hidden rounded-2xl border border-border bg-white"
    >
      <View className="aspect-square w-full bg-brand-50">
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            // Cache hints: memory-disk so previously seen products
            // appear instantly on scroll-back. recyclingKey ties the
            // image to this product id so when FlatList recycles a cell
            // for a different product, we drop the old image instead of
            // briefly showing it under the new label.
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={product.id}
          />
        ) : (
          <View className="size-full items-center justify-center">
            <Text className="text-[40px]">🛍</Text>
          </View>
        )}
        {/* Badge overlay (HOT / NEW / SALE / discount %) */}
        {product.badge || hasDiscount ? (
          <View className="absolute left-1.5 top-1.5 flex-row gap-1">
            {product.badge ? (
              <View
                className={`rounded px-1.5 py-0.5 ${
                  product.badge === "HOT"
                    ? "bg-rose-600"
                    : product.badge === "NEW"
                      ? "bg-emerald-600"
                      : "bg-amber-500"
                }`}
              >
                <Text className="text-[9px] font-bold uppercase tracking-wider text-white">
                  {product.badge}
                </Text>
              </View>
            ) : null}
            {hasDiscount ? (
              <View className="rounded bg-brand-600 px-1.5 py-0.5">
                <Text className="text-[9px] font-bold text-white">
                  -{discountPct}%
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <View className="p-2.5">
        <Text className="text-[13px] font-medium text-fg" numberOfLines={2}>
          {product.name}
        </Text>
        <View className="mt-1 flex-row items-baseline gap-1.5">
          <Text className="text-[15px] font-bold text-brand-700">
            {formatBaht(product.priceSatang)}
          </Text>
          {hasDiscount ? (
            <Text className="text-[10px] text-muted line-through">
              {formatBaht(product.compareAtSatang!)}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/s/${product.shopSlug}`);
          }}
          className="mt-1.5 flex-row items-center gap-1.5"
          hitSlop={4}
        >
          <Text
            className="flex-1 text-[10px] text-muted"
            numberOfLines={1}
          >
            {product.shopName}
          </Text>
          <VerifiedBadge kycStatus={product.shopKycStatus} compact />
        </Pressable>
        <View className="mt-1 flex-row items-center gap-2">
          {product.shopRating > 0 ? (
            <Text className="text-[9px] text-muted">
              ⭐ {product.shopRating.toFixed(1)}
            </Text>
          ) : null}
          {product.sold > 0 ? (
            <Text className="text-[9px] text-muted">
              ขายแล้ว {product.sold.toLocaleString()}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const CategoryChip = memo(function CategoryChip({
  Icon,
  label,
  active,
  onPress,
}: {
  Icon: LucideIcon;
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
      <Icon
        size={20}
        color={active ? "#e11d48" : "#0a0a0a"}
        strokeWidth={active ? 2.2 : 1.8}
      />
      <Text
        className={`mt-1 text-[11px] ${active ? "font-semibold text-brand-700" : "text-fg"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
});

function EmptyState({ category }: { category: string | null }) {
  const { t } = useTranslation("home");
  return (
    <View className="mx-5 mt-6 rounded-3xl border border-dashed border-border bg-white p-8">
      <Text className="text-center text-[15px] font-semibold text-fg">
        {category ? t("emptyCategory") : t("emptyAll")}
      </Text>
      <Text className="mt-1 text-center text-[12px] text-muted">
        {t("emptyHint")}
      </Text>
    </View>
  );
}

function ErrorState({ error }: { error: unknown }) {
  const { t } = useTranslation("common");
  return (
    <View className="mx-5 mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6">
      <Text className="text-center text-[14px] text-rose-700">
        {t("states.loadFailed")} —{" "}
        {error instanceof Error ? error.message : t("states.error")}
      </Text>
    </View>
  );
}
