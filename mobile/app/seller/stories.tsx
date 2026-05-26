import { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useSellerMode } from "@/store/seller-mode";

/**
 * /seller/stories — owner's active stories list + post-new CTA.
 *
 * Stories are 24h ephemeral, so the list always fits comfortably without
 * pagination — server caps at 20 active per shop and the cron prunes the
 * rest hourly. We render newest-first (createdAt desc) here even though
 * the public viewer plays oldest-first (chronological narrative).
 */
export default function SellerStoriesScreen() {
  const activeSlug = useSellerMode((s) => s.activeShopSlug);
  const shopsQuery = useQuery({
    queryKey: ["me", "shops"],
    queryFn: () => api.me.shops(),
  });

  // Auto-pick first shop if none selected — matches /seller dashboard
  // behavior so a single-shop owner doesn't see an empty screen.
  const setActiveShop = useSellerMode((s) => s.setActiveShop);
  useEffect(() => {
    if (!activeSlug && shopsQuery.data?.shops?.[0]) {
      setActiveShop(shopsQuery.data.shops[0].slug);
    }
  }, [activeSlug, shopsQuery.data, setActiveShop]);

  const storiesQuery = useQuery({
    queryKey: ["seller", "stories", activeSlug],
    queryFn: () => api.stories.forShop(activeSlug!),
    enabled: Boolean(activeSlug),
  });

  if (!activeSlug) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-32"
        refreshControl={
          <RefreshControl
            refreshing={storiesQuery.isFetching}
            onRefresh={() => void storiesQuery.refetch()}
            tintColor="#e11d48"
          />
        }
      >
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            สตอรี่ร้าน · 24 ชั่วโมง
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            สตอรี่ที่กำลังโชว์
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            สตอรี่จะหายไปอัตโนมัติหลัง 24 ชม. ใช้สำหรับโปร, ของใหม่, หรือ behind-the-scenes
          </Text>
        </View>

        {storiesQuery.isLoading ? (
          <View className="py-16">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : storiesQuery.data && storiesQuery.data.stories.length > 0 ? (
          <View className="mt-4 gap-2 px-5">
            {storiesQuery.data.stories.map((s) => (
              <View
                key={s.id}
                className="flex-row items-center gap-3 rounded-2xl border border-border bg-white p-3"
              >
                <View className="size-16 overflow-hidden rounded-xl bg-soft">
                  {s.mediaKind === "IMAGE" ? (
                    <Image
                      source={{ uri: s.mediaUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Text className="text-[18px]">▶</Text>
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <Text
                    className="text-[12px] font-semibold text-fg"
                    numberOfLines={2}
                  >
                    {s.caption ?? "(ไม่มีคำบรรยาย)"}
                  </Text>
                  <Text className="mt-1 text-[10px] text-muted">
                    👁 {s.viewCount.toLocaleString()} ครั้ง · เหลืออีก{" "}
                    {timeUntil(s.expiresAt)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="mx-5 mt-8 items-center rounded-3xl border border-dashed border-border p-8">
            <Text className="text-[28px]">📸</Text>
            <Text className="mt-2 text-[14px] font-semibold text-fg">
              ยังไม่มีสตอรี่
            </Text>
            <Text className="mt-1 text-center text-[11px] text-muted">
              โพสต์รูปหรือวิดีโอสั้นๆ เพื่อโชว์ของใหม่{"\n"}
              หรือบอกลูกค้าว่ามีโปรอะไร
            </Text>
          </View>
        )}

        <View className="mx-5 mt-6 rounded-2xl border border-dashed border-border p-4">
          <Text className="text-[11px] leading-relaxed text-muted">
            💡 เคล็ดลับ: รูปประกอบ + caption สั้นๆ + ใส่ลิงก์ไปสินค้า
            จะเปลี่ยนผู้ดูเป็นผู้ซื้อได้เร็วที่สุด
          </Text>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white p-4">
        <Button onPress={() => router.push("/seller/stories/new")}>
          + โพสต์สตอรี่ใหม่
        </Button>
      </View>
    </Screen>
  );
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "หมดเวลา";
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours} ชม. ${mins} นาที`;
  return `${mins} นาที`;
}
