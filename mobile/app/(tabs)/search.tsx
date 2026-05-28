import { memo, useState, useDeferredValue, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { getAuthToken } from "@/lib/auth";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/ui/screen";
import { VerifiedBadge, TrustMeter } from "@/components/trust-badge";
import { ShopCover } from "@/components/shop-cover";
import { DiscoveryRails } from "@/components/discovery-rails";
import { AppLogo } from "@/components/brand/app-logo";
import {
  Search,
  SlidersHorizontal,
  X,
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
  type LucideIcon,
} from "lucide-react-native";
import {
  SearchFilterSheet,
  DEFAULT_FILTERS,
  type SearchFilters,
} from "@/components/search-filter-sheet";
import { api } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import {
  getRecentSearches,
  pushRecentSearch,
  clearRecentSearches,
} from "@/lib/recent-searches";
import type { ShopSummary } from "@/types/api";

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

type ShopsTab = "for-you" | "new" | "following";

/**
 * Shops tab (V1.1) — formerly the search-only screen. Two modes:
 *
 *   1. Browse mode (empty query): shop discovery — tab strip (for-you /
 *      new / following) + categories + featured rail + paginated shop list.
 *      This is what the home tab used to show before V1.1's product-first
 *      home pivot.
 *   2. Search mode (≥2 chars): keyword search across shops + products,
 *      with the existing filter sheet. Results match the old behaviour so
 *      power users get continuity.
 */
export default function ShopsScreen() {
  const { t } = useTranslation(["shop", "common"]);
  const [q, setQ] = useState("");
  const debounced = useDeferredValue(q);
  const trimmed = debounced.trim();
  const searchEnabled = trimmed.length >= 2;

  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);

  // Browse mode state
  const [browseTab, setBrowseTab] = useState<ShopsTab>("for-you");
  const [browseCategory, setBrowseCategory] = useState<string | null>(null);
  const [browseVerifiedOnly, setBrowseVerifiedOnly] = useState(false);

  // Auth gate for the "Following" tab. We hide the chip + bounce the
  // tab back to "for-you" when an anonymous viewer somehow ends up
  // there (911korn 2026-05-27 "ถ้าแค่ดู shops เฉยๆ ไม่ต้องบังคับ login").
  const [authed, setAuthed] = useState(false);
  useFocusEffect(
    useCallback(() => {
      void getAuthToken().then((tok) => setAuthed(Boolean(tok)));
    }, []),
  );
  const effectiveBrowseTab =
    !authed && browseTab === "following" ? "for-you" : browseTab;

  // Search query (search mode only)
  const searchQuery = useQuery({
    queryKey: ["search", trimmed, filters],
    queryFn: () =>
      api.search({
        q: trimmed,
        sort: filters.sort,
        verified: filters.verifiedOnly || undefined,
        minPriceSatang: filters.minPriceBaht
          ? Number(filters.minPriceBaht) * 100
          : undefined,
        maxPriceSatang: filters.maxPriceBaht
          ? Number(filters.maxPriceBaht) * 100
          : undefined,
        minRating: filters.minRating > 0 ? filters.minRating : undefined,
      }),
    enabled: searchEnabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (searchQuery.data && searchEnabled) {
      void pushRecentSearch(trimmed).then(() => {
        void getRecentSearches().then(setRecents);
      });
    }
  }, [searchQuery.data, trimmed, searchEnabled]);

  useEffect(() => {
    void getRecentSearches().then(setRecents);
  }, []);

  // Browse query — paginated shops feed (only fires in browse mode)
  const shopsQuery = useInfiniteQuery({
    queryKey: ["feed", effectiveBrowseTab, browseCategory, browseVerifiedOnly],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.feed.list({
        tab: effectiveBrowseTab,
        category: browseCategory ?? undefined,
        verified: browseVerifiedOnly || undefined,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !searchEnabled,
  });
  const allShops = shopsQuery.data?.pages.flatMap((p) => p.shops) ?? [];

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (searchEnabled) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (
      distanceFromBottom < 600 &&
      shopsQuery.hasNextPage &&
      !shopsQuery.isFetchingNextPage
    ) {
      void shopsQuery.fetchNextPage();
    }
  }

  const activeFilterCount = countActiveFilters(filters);

  return (
    <Screen safeTop>
      {/* Header — logo + search bar + filter button */}
      <View className="px-5 pt-2 pb-3">
        <View className="mb-3">
          <AppLogo size={22} />
        </View>
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center gap-2 rounded-full border border-border bg-white px-4 py-2.5">
            <Search size={16} color="#737373" strokeWidth={2} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t("search.placeholder")}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className="flex-1 text-[15px] text-fg"
            />
            {q.length > 0 ? (
              <Pressable onPress={() => setQ("")} hitSlop={8}>
                <X size={16} color="#737373" strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>
          {searchEnabled ? (
            <Pressable
              onPress={() => setFilterOpen(true)}
              className={`relative size-11 items-center justify-center rounded-full border ${
                activeFilterCount > 0
                  ? "border-brand-300 bg-brand-50"
                  : "border-border bg-white"
              }`}
            >
              <SlidersHorizontal
                size={16}
                color={activeFilterCount > 0 ? "#e11d48" : "#0a0a0a"}
                strokeWidth={2}
              />
              {activeFilterCount > 0 ? (
                <View className="absolute -right-1 -top-1 size-5 items-center justify-center rounded-full bg-brand-600">
                  <Text className="text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      </View>

      <SearchFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={setFilters}
      />

      <ScrollView
        contentContainerClassName="pb-32"
        refreshControl={
          !searchEnabled ? (
            <RefreshControl
              refreshing={
                shopsQuery.isRefetching && !shopsQuery.isFetchingNextPage
              }
              onRefresh={() => void shopsQuery.refetch()}
              tintColor="#e11d48"
            />
          ) : undefined
        }
        onScroll={handleScroll}
        scrollEventThrottle={120}
      >
        {searchEnabled ? (
          <SearchResults
            query={trimmed}
            data={searchQuery.data}
            loading={searchQuery.isLoading}
            error={searchQuery.error}
            activeFilterCount={activeFilterCount}
            onResetFilters={() => setFilters(DEFAULT_FILTERS)}
          />
        ) : (
          <BrowseMode
            recents={recents}
            onPickRecent={(term) => setQ(term)}
            onClearRecents={() => {
              void clearRecentSearches().then(() => setRecents([]));
            }}
            browseTab={effectiveBrowseTab}
            setBrowseTab={setBrowseTab}
            authed={authed}
            browseCategory={browseCategory}
            setBrowseCategory={setBrowseCategory}
            browseVerifiedOnly={browseVerifiedOnly}
            setBrowseVerifiedOnly={setBrowseVerifiedOnly}
            shops={allShops}
            isLoading={shopsQuery.isLoading}
            isFetchingNextPage={shopsQuery.isFetchingNextPage}
            hasNextPage={shopsQuery.hasNextPage}
            error={shopsQuery.error}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

interface BrowseProps {
  recents: string[];
  onPickRecent: (term: string) => void;
  onClearRecents: () => void;
  browseTab: ShopsTab;
  setBrowseTab: (t: ShopsTab) => void;
  browseCategory: string | null;
  setBrowseCategory: (c: string | null) => void;
  browseVerifiedOnly: boolean;
  setBrowseVerifiedOnly: (v: boolean) => void;
  authed: boolean;
  shops: ShopSummary[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: unknown;
}

function BrowseMode(props: BrowseProps) {
  const { t } = useTranslation(["shop", "common"]);
  const {
    recents,
    onPickRecent,
    onClearRecents,
    browseTab,
    setBrowseTab,
    browseCategory,
    setBrowseCategory,
    browseVerifiedOnly,
    setBrowseVerifiedOnly,
    authed,
    shops,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
  } = props;

  return (
    <>
      {recents.length > 0 ? (
        <View className="px-5 pb-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {t("search.recents")}
            </Text>
            <Pressable onPress={onClearRecents} hitSlop={8}>
              <Text className="text-[11px] text-brand-700">{t("search.clearAll")}</Text>
            </Pressable>
          </View>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {recents.map((term) => (
              <Pressable
                key={term}
                onPress={() => onPickRecent(term)}
                className="rounded-full border border-border bg-white px-3 py-1.5"
              >
                <Text className="text-[12px] text-fg">{term}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Tab strip + Verified toggle */}
      <View className="mt-1 flex-row items-center gap-2 px-5">
        {(
          [
            { key: "for-you", labelKey: "filters.recommended", auth: false },
            { key: "new", labelKey: "filters.newest", auth: false },
            { key: "following", labelKey: "filters.following", auth: true },
          ] as const
        ).filter((t) => !t.auth || authed).map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setBrowseTab(tab.key as ShopsTab)}
            className={`rounded-full px-3.5 py-1.5 ${
              browseTab === tab.key ? "bg-brand-600" : "border border-border bg-white"
            }`}
          >
            <Text
              className={`text-[12px] font-semibold ${
                browseTab === tab.key ? "text-white" : "text-fg"
              }`}
            >
              {t(`common:${tab.labelKey}`)}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setBrowseVerifiedOnly(!browseVerifiedOnly)}
          className={`ml-auto flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
            browseVerifiedOnly
              ? "border border-emerald-300 bg-emerald-50"
              : "border border-border bg-white"
          }`}
        >
          <Text
            className={
              browseVerifiedOnly ? "text-[11px]" : "text-[11px] opacity-50"
            }
          >
            ✓
          </Text>
          <Text
            className={`text-[11px] font-semibold ${
              browseVerifiedOnly ? "text-emerald-700" : "text-muted"
            }`}
          >
            {t("common:filters.verified")}
          </Text>
        </Pressable>
      </View>

      {/* Featured + Flash Sale rails */}
      <DiscoveryRails />

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 py-3 gap-2"
      >
        <CategoryChip
          Icon={Star}
          label={t("common:filters.all")}
          active={browseCategory === null}
          onPress={() => setBrowseCategory(null)}
        />
        {CATEGORY_KEYS.map((key) => (
          <CategoryChip
            key={key}
            Icon={CATEGORY_ICONS[key]}
            label={t(`common:categories.${key}`)}
            active={browseCategory === key}
            onPress={() => setBrowseCategory(key)}
          />
        ))}
      </ScrollView>

      {/* Shop list */}
      {isLoading ? (
        <View className="py-16">
          <ActivityIndicator color="#e11d48" />
        </View>
      ) : error ? (
        <View className="mx-5 mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6">
          <Text className="text-center text-[14px] text-rose-700">
            {t("common:states.loadFailed")} —{" "}
            {error instanceof Error ? error.message : t("common:states.error")}
          </Text>
        </View>
      ) : shops.length === 0 ? (
        <View className="mx-5 mt-6 rounded-3xl border border-dashed border-border bg-white p-8">
          <Text className="text-center text-[15px] font-semibold text-fg">
            {t("search.emptyShops")}
          </Text>
          <Text className="mt-1 text-center text-[12px] text-muted">
            {t("search.emptyShopsHint")}
          </Text>
        </View>
      ) : (
        <View className="gap-3 px-5">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
          {isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator color="#e11d48" />
            </View>
          ) : !hasNextPage && shops.length > 6 ? (
            <Text className="py-4 text-center text-[11px] text-muted">
              {t("common:states.endOfList")}
            </Text>
          ) : null}
        </View>
      )}
    </>
  );
}

function SearchResults({
  query,
  data,
  loading,
  error,
  activeFilterCount,
  onResetFilters,
}: {
  query: string;
  data: Awaited<ReturnType<typeof api.search>> | undefined;
  loading: boolean;
  error: unknown;
  activeFilterCount: number;
  onResetFilters: () => void;
}) {
  const { t } = useTranslation(["shop"]);
  if (loading) {
    return (
      <View className="py-12">
        <ActivityIndicator color="#e11d48" />
      </View>
    );
  }
  if (error) {
    return (
      <View className="mx-5 mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <Text className="text-center text-[14px] text-rose-700">
          {t("search.errorBody")}
        </Text>
      </View>
    );
  }
  if (!data) return null;
  return (
    <>
      {data.shops.length ? (
        <View className="px-5">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t("search.shopsRelated")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 py-3"
          >
            {data.shops.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/s/${s.slug}`)}
                className="flex-row items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5"
              >
                <View
                  className="size-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: s.themeColor }}
                >
                  <Text className="text-[10px] font-bold text-white">
                    {s.logoText ?? s.name.slice(0, 1)}
                  </Text>
                </View>
                <Text
                  className="text-[12px] font-medium text-fg"
                  numberOfLines={1}
                >
                  {s.name}
                </Text>
                <VerifiedBadge kycStatus={s.kycStatus} compact />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View className="px-4 pt-2">
        <View className="flex-row flex-wrap">
          {data.products.map((p) => (
            <Pressable
              key={`${p.shopSlug}-${p.slug}`}
              onPress={() => router.push(`/s/${p.shopSlug}/${p.slug}`)}
              className="m-1 w-[48%] overflow-hidden rounded-2xl border border-border bg-white"
            >
              <View className="aspect-square w-full bg-brand-50">
                {p.imageUrl ? (
                  <Image
                    source={{ uri: p.imageUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                    recyclingKey={`${p.shopSlug}-${p.slug}`}
                  />
                ) : null}
              </View>
              <View className="p-3">
                <View className="flex-row items-center gap-1">
                  <Text
                    className="flex-1 text-[12px] text-muted"
                    numberOfLines={1}
                  >
                    {p.shopName}
                  </Text>
                  <VerifiedBadge
                    kycStatus={p.shopKycStatus ?? "NONE"}
                    compact
                  />
                </View>
                <Text
                  className="mt-0.5 text-[13px] font-medium text-fg"
                  numberOfLines={2}
                >
                  {p.name}
                </Text>
                <Text className="mt-1 text-[15px] font-bold text-brand-700">
                  {formatBaht(p.priceSatang)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
        {data.products.length === 0 && data.shops.length === 0 ? (
          <View className="mt-8 px-5">
            <Text className="text-center text-[14px] text-muted">
              {t("search.noResults", { query })}
              {activeFilterCount > 0 ? `\n${t("search.noResultsHint")}` : ""}
            </Text>
            {activeFilterCount > 0 ? (
              <Pressable
                onPress={onResetFilters}
                className="mx-auto mt-3 rounded-full border border-border bg-white px-3 py-1.5"
              >
                <Text className="text-[12px] font-medium text-brand-700">
                  {t("search.resetFilters")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );
}

const ShopCard = memo(function ShopCard({ shop }: { shop: ShopSummary }) {
  return (
    <Pressable
      onPress={() => router.push(`/s/${shop.slug}`)}
      className="overflow-hidden rounded-3xl border border-border bg-white"
    >
      <ShopCover
        bannerUrl={shop.bannerUrls[0]}
        themeColor={shop.themeColor}
        height={96}
      />
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
              recyclingKey={shop.id}
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
              <Text className="text-[11px] text-muted">
                ⭐ {shop.rating.toFixed(1)}
              </Text>
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
      className={`items-center justify-center rounded-2xl px-3 py-2 ${
        active
          ? "bg-brand-50 border border-brand-200"
          : "bg-white border border-border"
      }`}
    >
      <Icon
        size={18}
        color={active ? "#e11d48" : "#0a0a0a"}
        strokeWidth={active ? 2.2 : 1.8}
      />
      <Text
        className={`mt-0.5 text-[10px] ${
          active ? "font-semibold text-brand-700" : "text-fg"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
});

function countActiveFilters(f: SearchFilters): number {
  let n = 0;
  if (f.sort !== "relevance") n++;
  if (f.verifiedOnly) n++;
  if (f.minPriceBaht || f.maxPriceBaht) n++;
  if (f.minRating > 0) n++;
  return n;
}
