import { useState, useDeferredValue, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { TabBar } from "@/components/ui/tab-bar";
import { VerifiedBadge } from "@/components/trust-badge";
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

export default function SearchScreen() {
  const [q, setQ] = useState("");
  const debounced = useDeferredValue(q);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);

  const trimmed = debounced.trim();
  const enabled = trimmed.length >= 2;

  // Convert UI filter state into the wire format the search API wants.
  const queryParams = {
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
  };

  const searchQuery = useQuery({
    queryKey: ["search", trimmed, filters],
    queryFn: () => api.search(queryParams),
    enabled,
    staleTime: 30_000,
  });

  // Persist successful (non-empty) search terms to recent history. We push
  // after the query resolves so we don't store junk that returned errors.
  useEffect(() => {
    if (searchQuery.data && enabled) {
      void pushRecentSearch(trimmed).then(() => {
        void getRecentSearches().then(setRecents);
      });
    }
  }, [searchQuery.data, trimmed, enabled]);

  // Load recents on mount so the empty state is populated immediately.
  useEffect(() => {
    void getRecentSearches().then(setRecents);
  }, []);

  const activeFilterCount = countActiveFilters(filters);

  return (
    <Screen>
      {/* Search bar + filter button */}
      <View className="px-5 pt-10 pb-3">
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center gap-2 rounded-full border border-border bg-white px-4 py-2.5">
            <Text className="text-[16px] text-muted">🔍</Text>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="ค้นหาสินค้า / ร้าน"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className="flex-1 text-[15px] text-fg"
            />
            {q.length > 0 ? (
              <Pressable onPress={() => setQ("")} hitSlop={8}>
                <Text className="text-[16px] text-muted">×</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => setFilterOpen(true)}
            className={`relative size-11 items-center justify-center rounded-full border ${
              activeFilterCount > 0
                ? "border-brand-300 bg-brand-50"
                : "border-border bg-white"
            }`}
          >
            <Text className="text-[16px]">☰</Text>
            {activeFilterCount > 0 ? (
              <View className="absolute -right-1 -top-1 size-5 items-center justify-center rounded-full bg-brand-600">
                <Text className="text-[10px] font-bold text-white">
                  {activeFilterCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <SearchFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={setFilters}
      />

      <ScrollView contentContainerClassName="pb-32">
        {!enabled ? (
          <View className="px-5 pt-6">
            {recents.length > 0 ? (
              <View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    ค้นหาล่าสุด
                  </Text>
                  <Pressable
                    onPress={() => {
                      void clearRecentSearches().then(() => setRecents([]));
                    }}
                    hitSlop={8}
                  >
                    <Text className="text-[11px] text-brand-700">ล้างทั้งหมด</Text>
                  </Pressable>
                </View>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {recents.map((term) => (
                    <Pressable
                      key={term}
                      onPress={() => setQ(term)}
                      className="rounded-full border border-border bg-white px-3 py-1.5"
                    >
                      <Text className="text-[12px] text-fg">{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <Text className="text-center text-[14px] text-muted">
                พิมพ์ชื่อสินค้าหรือร้านเพื่อเริ่มค้นหา
              </Text>
            )}
          </View>
        ) : searchQuery.isLoading ? (
          <View className="py-12">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : searchQuery.error ? (
          <View className="mx-5 mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6">
            <Text className="text-center text-[14px] text-rose-700">
              ค้นหาไม่สำเร็จ — ลองใหม่
            </Text>
          </View>
        ) : (
          <>
            {/* Shop chips */}
            {searchQuery.data?.shops.length ? (
              <View className="px-5">
                <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  ร้านที่เกี่ยวข้อง
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2 py-3"
                >
                  {searchQuery.data.shops.map((s) => (
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
                      <Text className="text-[12px] font-medium text-fg" numberOfLines={1}>
                        {s.name}
                      </Text>
                      <VerifiedBadge kycStatus={s.kycStatus} compact />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Product grid */}
            <View className="px-4 pt-2">
              <View className="flex-row flex-wrap">
                {searchQuery.data?.products.map((p) => (
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
                        />
                      ) : null}
                    </View>
                    <View className="p-3">
                      <View className="flex-row items-center gap-1">
                        <Text className="flex-1 text-[12px] text-muted" numberOfLines={1}>
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
              {searchQuery.data?.products.length === 0 &&
              searchQuery.data?.shops.length === 0 ? (
                <View className="mt-8 px-5">
                  <Text className="text-center text-[14px] text-muted">
                    ไม่พบผลการค้นหาสำหรับ &quot;{trimmed}&quot;
                    {activeFilterCount > 0
                      ? "\nลองลดตัวกรองหรือรีเซ็ต"
                      : ""}
                  </Text>
                  {activeFilterCount > 0 ? (
                    <Pressable
                      onPress={() => setFilters(DEFAULT_FILTERS)}
                      className="mx-auto mt-3 rounded-full border border-border bg-white px-3 py-1.5"
                    >
                      <Text className="text-[12px] font-medium text-brand-700">
                        รีเซ็ตตัวกรอง
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <TabBar active="search" />
    </Screen>
  );
}

function countActiveFilters(f: SearchFilters): number {
  let n = 0;
  if (f.sort !== "relevance") n++;
  if (f.verifiedOnly) n++;
  if (f.minPriceBaht || f.maxPriceBaht) n++;
  if (f.minRating > 0) n++;
  return n;
}
