import { memo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { api } from "@/lib/api";

/**
 * Live + upcoming carousel for the home feed. Self-hides when both lists
 * are empty so the rail doesn't take vertical space on quiet days.
 *
 * Memoised so the feed screen's filter-state changes (sort, category,
 * verifiedOnly) don't re-render the rail's polling subtree.
 */
export const LiveRail = memo(function LiveRail() {
  const liveQuery = useQuery({
    queryKey: ["live"],
    queryFn: () => api.live.list(),
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  if (!liveQuery.data) return null;
  const { live, upcoming } = liveQuery.data;
  if (live.length === 0 && upcoming.length === 0) return null;

  return (
    <View className="mt-3">
      <View className="px-5">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">
          🔴 ไลฟ์ตอนนี้
        </Text>
        <Text className="mt-0.5 text-[14px] font-bold text-fg">
          ดูสด · พักสินค้า · ซื้อในแอป
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 py-3 gap-3"
      >
        {live.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => router.push(`/live/${b.id}`)}
            className="w-44 overflow-hidden rounded-2xl border border-rose-200 bg-white"
          >
            <View
              className="aspect-[3/4] w-full"
              style={{ backgroundColor: b.shop.themeColor }}
            >
              {b.coverImageUrl ? (
                <Image
                  source={{ uri: b.coverImageUrl }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : null}
              <View className="absolute left-2 top-2 flex-row items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5">
                <View className="size-1.5 rounded-full bg-white" />
                <Text className="text-[9px] font-bold uppercase text-white">
                  Live
                </Text>
              </View>
              <View className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5">
                <Text className="text-[10px] text-white">
                  👁 {b.viewerCount.toLocaleString()}
                </Text>
              </View>
            </View>
            <View className="p-2">
              <Text
                className="text-[12px] font-semibold text-fg"
                numberOfLines={2}
              >
                {b.title}
              </Text>
              <Text className="mt-0.5 text-[10px] text-muted" numberOfLines={1}>
                {b.shop.name}
              </Text>
            </View>
          </Pressable>
        ))}
        {upcoming.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => router.push(`/live/${b.id}`)}
            className="w-44 overflow-hidden rounded-2xl border border-border bg-white opacity-90"
          >
            <View
              className="aspect-[3/4] w-full"
              style={{ backgroundColor: b.shop.themeColor }}
            >
              {b.coverImageUrl ? (
                <Image
                  source={{ uri: b.coverImageUrl }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : null}
              <View className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5">
                <Text className="text-[9px] font-bold uppercase text-white">
                  🕒 รอเริ่ม
                </Text>
              </View>
            </View>
            <View className="p-2">
              <Text
                className="text-[12px] font-semibold text-fg"
                numberOfLines={2}
              >
                {b.title}
              </Text>
              <Text className="mt-0.5 text-[10px] text-muted" numberOfLines={1}>
                {b.shop.name}
                {b.scheduledAt
                  ? ` · ${new Date(b.scheduledAt).toLocaleString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}`
                  : ""}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
});
