import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useSellerMode } from "@/store/seller-mode";

/**
 * /seller/chat — Business+ inbox listing.
 *
 * If the shop hasn't configured LINE Messaging API yet (`lineWebhookEnabled
 * = false` from the server), we show an upgrade CTA pointing to the web
 * dashboard's LINE OA setup page rather than a misleading empty state.
 *
 * Tap a row → navigate to /seller/chat/<id>. We poll every 15s so seller
 * sees new inbound messages without manual refresh — Pusher-based real-time
 * is the V1.6 milestone.
 */
export default function SellerChatListScreen() {
  const slug = useSellerMode((s) => s.activeShopSlug);

  const convQuery = useQuery({
    queryKey: ["seller", "conversations", slug],
    queryFn: () => api.shops.conversations(slug!),
    enabled: Boolean(slug),
    refetchInterval: 15_000,
  });

  if (!slug) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-fg">เลือกร้านที่ /seller ก่อน</Text>
          <Button
            variant="outline"
            className="mt-4"
            onPress={() => router.replace("/seller")}
          >
            กลับ
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-16"
        refreshControl={
          <RefreshControl
            refreshing={convQuery.isFetching}
            onRefresh={() => void convQuery.refetch()}
            tintColor="#e11d48"
          />
        }
      >
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            แชทกับลูกค้า
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            กล่องข้อความ
          </Text>
        </View>

        {convQuery.isLoading ? (
          <View className="py-16">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : !convQuery.data?.lineWebhookEnabled ? (
          <View className="mx-5 mt-8 items-center rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <Text className="text-[28px]">💬</Text>
            <Text className="mt-2 text-[14px] font-semibold text-amber-900">
              ต้องอัปเกรดเป็นแพ็คเกจ Business+ ก่อน
            </Text>
            <Text className="mt-1 text-center text-[12px] leading-relaxed text-amber-700">
              เชื่อม LINE Official Account เพื่อรับ-ส่งข้อความกับลูกค้า {"\n"}
              ตั้งค่าได้ที่ Dashboard เว็บ
            </Text>
            <Pressable
              onPress={() =>
                Linking.openURL(
                  `https://salepage.in.th/dashboard/${slug}/settings/line`,
                )
              }
              className="mt-4 rounded-full bg-amber-600 px-4 py-2"
            >
              <Text className="text-[12px] font-semibold text-white">
                เปิดใช้งานที่เว็บ ↗
              </Text>
            </Pressable>
          </View>
        ) : convQuery.data.conversations.length === 0 ? (
          <View className="mx-5 mt-8 items-center rounded-2xl border border-dashed border-border p-10">
            <Text className="text-[28px]">📭</Text>
            <Text className="mt-2 text-[13px] text-muted">
              ยังไม่มีข้อความจากลูกค้า
            </Text>
          </View>
        ) : (
          <View className="mt-3 px-5">
            {convQuery.data.conversations.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/seller/chat/${c.id}`)}
                className="flex-row items-center gap-3 border-b border-border py-3"
              >
                <View className="size-12 overflow-hidden rounded-full bg-brand-100">
                  {c.customerPictureUrl ? (
                    <Image
                      source={{ uri: c.customerPictureUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="size-full items-center justify-center">
                      <Text className="text-[18px] font-bold text-brand-700">
                        {(c.customerName ?? "?").slice(0, 1)}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className="flex-1 text-[14px] font-semibold text-fg"
                      numberOfLines={1}
                    >
                      {c.customerName ?? "ลูกค้า LINE"}
                    </Text>
                    <Text className="text-[10px] text-muted">
                      {new Date(c.lastMessageAt).toLocaleString("th-TH", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text
                      className={`flex-1 text-[12px] ${
                        c.unreadCount > 0
                          ? "font-semibold text-fg"
                          : "text-muted"
                      }`}
                      numberOfLines={1}
                    >
                      {c.lastMessageText ?? "(ไม่มีข้อความ)"}
                    </Text>
                    {c.unreadCount > 0 ? (
                      <View className="size-5 items-center justify-center rounded-full bg-rose-600">
                        <Text className="text-[10px] font-bold text-white">
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
