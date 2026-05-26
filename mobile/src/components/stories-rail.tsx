import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { api } from "@/lib/api";

/**
 * Stories rail — horizontal carousel of shop circles with unviewed-indicator
 * gradient borders. Tapping a circle opens `/stories/<slug>` viewer.
 *
 * Self-hides when there are no active stories so empty days don't take up
 * vertical real estate on the home feed.
 */
export function StoriesRail() {
  const storiesQuery = useQuery({
    queryKey: ["stories"],
    queryFn: () => api.stories.list(),
    // Refetch on focus is enough — 24h TTL means new posts during a session
    // are rare. Manual pull-to-refresh on the feed cascades here too.
    staleTime: 60_000,
  });

  if (storiesQuery.isLoading) {
    return (
      <View className="py-2">
        <ActivityIndicator color="#e11d48" />
      </View>
    );
  }
  if (!storiesQuery.data || storiesQuery.data.shops.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 px-5 py-3"
    >
      {storiesQuery.data.shops.map((g) => (
        <Pressable
          key={g.shop.id}
          onPress={() => router.push(`/stories/${g.shop.slug}`)}
          className="items-center"
          style={{ width: 64 }}
        >
          {/* Gradient ring — pink/orange combo signals "fresh story". */}
          <View className="size-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-amber-400 p-[2.5px]">
            <View
              className="size-full items-center justify-center overflow-hidden rounded-full bg-white p-0.5"
              style={{ backgroundColor: "#fff" }}
            >
              <View
                className="size-full items-center justify-center overflow-hidden rounded-full"
                style={{ backgroundColor: g.shop.themeColor }}
              >
                {g.shop.logoUrl ? (
                  <Image
                    source={{ uri: g.shop.logoUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : (
                  <Text className="text-[16px] font-bold text-white">
                    {g.shop.logoText ?? g.shop.name.slice(0, 1)}
                  </Text>
                )}
              </View>
            </View>
          </View>
          <Text
            className="mt-1 text-[10px] text-fg"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {g.shop.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
