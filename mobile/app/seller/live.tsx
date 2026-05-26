import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { useSellerMode } from "@/store/seller-mode";

/**
 * /seller/live — owner-facing live broadcast cockpit.
 *
 * Two modes:
 *   1. Currently LIVE → show big "End live" + viewer count + pin product picker.
 *   2. SCHEDULED + ENDED list → show recent broadcasts + a "+ New broadcast" CTA.
 *
 * V2.0 scope: this screen is a control panel only — actual camera capture
 * lives on the future RTC SDK integration. We just expose the state machine
 * (start / pin / end) so the rest of the stack can be wired end-to-end.
 */
export default function SellerLiveScreen() {
  const activeSlug = useSellerMode((s) => s.activeShopSlug);
  const queryClient = useQueryClient();

  const broadcastsQuery = useQuery({
    queryKey: ["seller", "live", activeSlug],
    queryFn: () => api.live.forShop(activeSlug!),
    enabled: Boolean(activeSlug),
    refetchInterval: 10_000,
  });

  // Find the in-flight broadcast (if any) so we can render the cockpit UI.
  const liveOne = broadcastsQuery.data?.broadcasts.find(
    (b) => b.status === "LIVE",
  );

  if (!activeSlug) {
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
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            ไลฟ์ขาย · V2.0
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            จัดการไลฟ์ของร้าน
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            สร้างไลฟ์เพื่อให้ลูกค้าดู live + พักสินค้าให้ลูกค้ากด &quot;ซื้อทันที&quot;
            (ระบบกล้องอยู่ใน beta — ใช้แอปอื่นถ่าย แล้ว link มาที่นี่)
          </Text>
        </View>

        {liveOne ? (
          <LiveCockpit
            slug={activeSlug}
            broadcastId={liveOne.id}
            title={liveOne.title}
            viewerCount={liveOne.viewerCount}
            totalViews={liveOne.totalViews}
            pinnedProductSlug={liveOne.pinnedProductSlug}
            onChanged={() =>
              queryClient.invalidateQueries({
                queryKey: ["seller", "live", activeSlug],
              })
            }
          />
        ) : null}

        {broadcastsQuery.isLoading ? (
          <View className="py-8">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : broadcastsQuery.data && broadcastsQuery.data.broadcasts.length > 0 ? (
          <View className="mx-5 mt-5 gap-2">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              ประวัติ
            </Text>
            {broadcastsQuery.data.broadcasts
              .filter((b) => b.id !== liveOne?.id)
              .map((b) => (
                <BroadcastRow
                  key={b.id}
                  broadcast={b}
                  slug={activeSlug}
                  onChanged={() =>
                    queryClient.invalidateQueries({
                      queryKey: ["seller", "live", activeSlug],
                    })
                  }
                />
              ))}
          </View>
        ) : (
          <View className="mx-5 mt-8 items-center rounded-3xl border border-dashed border-border p-8">
            <Text className="text-[28px]">📺</Text>
            <Text className="mt-2 text-[14px] font-semibold text-fg">
              ยังไม่เคยทำไลฟ์
            </Text>
            <Text className="mt-1 text-center text-[11px] text-muted">
              สร้างไลฟ์ใหม่ — ผู้ติดตามที่เปิดแจ้งเตือน &quot;ไลฟ์&quot; จะได้ push
            </Text>
          </View>
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white p-4">
        <Button onPress={() => router.push("/seller/live/new")}>
          + สร้างไลฟ์ใหม่
        </Button>
      </View>
    </Screen>
  );
}

function LiveCockpit({
  slug,
  broadcastId,
  title,
  viewerCount,
  totalViews,
  pinnedProductSlug,
  onChanged,
}: {
  slug: string;
  broadcastId: string;
  title: string;
  viewerCount: number;
  totalViews: number;
  pinnedProductSlug: string | null;
  onChanged: () => void;
}) {
  // Minimal product picker — paginated catalog keyed by shop slug. We only
  // render up to 20 here since the seller can search via a future filter UI.
  const productsQuery = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => api.shop.get(slug),
  });
  const products = productsQuery.data?.products ?? [];

  const pinMutation = useMutation({
    mutationFn: (productSlug: string | null) =>
      api.live.transition(broadcastId, { action: "pin", productSlug }),
    onSuccess: () => onChanged(),
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "Pin ล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  const endMutation = useMutation({
    mutationFn: () => api.live.transition(broadcastId, { action: "end" }),
    onSuccess: () => {
      onChanged();
      Alert.alert("ปิดไลฟ์เรียบร้อย", `รวมผู้ชมทั้งหมด ${totalViews} ครั้ง`);
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "ปิดไลฟ์ล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  return (
    <View className="mx-5 mt-4 overflow-hidden rounded-3xl bg-rose-600">
      <View className="flex-row items-center gap-2 px-5 pt-5">
        <View className="size-2.5 rounded-full bg-white" />
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-white">
          On Air
        </Text>
      </View>
      <Text className="px-5 pt-2 text-[18px] font-bold text-white">
        {title}
      </Text>
      <View className="mt-2 flex-row gap-4 px-5">
        <View>
          <Text className="text-[10px] uppercase tracking-wider text-rose-100">
            ผู้ชมตอนนี้
          </Text>
          <Text className="text-[20px] font-bold text-white">
            {viewerCount.toLocaleString()}
          </Text>
        </View>
        <View>
          <Text className="text-[10px] uppercase tracking-wider text-rose-100">
            ทั้งไลฟ์
          </Text>
          <Text className="text-[20px] font-bold text-white">
            {totalViews.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Pin product picker */}
      <View className="mt-4 border-t border-rose-500 px-5 py-4">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-rose-100">
          ปักหมุดสินค้า
        </Text>
        {pinnedProductSlug ? (
          <Pressable
            onPress={() => pinMutation.mutate(null)}
            className="mt-2 flex-row items-center gap-2 rounded-full bg-white/15 px-3 py-2"
          >
            <Text className="text-[12px] font-semibold text-white">
              📌 {pinnedProductSlug}
            </Text>
            <Text className="text-[10px] text-rose-100">(แตะเพื่อยกเลิก)</Text>
          </Pressable>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="mt-2 gap-2"
        >
          {products.slice(0, 20).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => pinMutation.mutate(p.slug)}
              className={`w-32 overflow-hidden rounded-xl border bg-white ${
                p.slug === pinnedProductSlug
                  ? "border-amber-400"
                  : "border-rose-200"
              }`}
            >
              <View className="aspect-square w-full bg-soft">
                {p.imageUrls?.[0] ? (
                  <Image
                    source={{ uri: p.imageUrls[0] }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : null}
              </View>
              <View className="p-2">
                <Text
                  className="text-[10px] font-semibold text-fg"
                  numberOfLines={2}
                >
                  {p.name}
                </Text>
                <Text className="text-[10px] font-bold text-rose-700">
                  {(p.priceSatang / 100).toLocaleString()} ฿
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View className="border-t border-rose-500 px-5 py-4">
        <Pressable
          onPress={() => {
            Alert.alert(
              "ปิดไลฟ์?",
              "ลูกค้าจะถูก disconnect ทั้งหมด — ปิดเลยไหม?",
              [
                { text: "ยกเลิก", style: "cancel" },
                {
                  text: "ปิดไลฟ์",
                  style: "destructive",
                  onPress: () => endMutation.mutate(),
                },
              ],
            );
          }}
          disabled={endMutation.isPending}
          className="items-center rounded-full bg-white py-3"
        >
          <Text className="text-[14px] font-semibold text-rose-700">
            🛑 ปิดไลฟ์
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function BroadcastRow({
  broadcast,
  slug,
  onChanged,
}: {
  broadcast: NonNullable<
    Awaited<ReturnType<typeof api.live.forShop>>
  >["broadcasts"][number];
  slug: string;
  onChanged: () => void;
}) {
  const startMutation = useMutation({
    mutationFn: () => api.live.transition(broadcast.id, { action: "start" }),
    onSuccess: () => onChanged(),
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "เริ่มไลฟ์ล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  // Silence unused-var lint until we add a "watch own broadcast" preview.
  void slug;

  const tone =
    broadcast.status === "SCHEDULED"
      ? { bg: "bg-amber-50", text: "text-amber-700", label: "รอเริ่ม" }
      : broadcast.status === "ENDED"
        ? { bg: "bg-zinc-100", text: "text-zinc-600", label: "จบแล้ว" }
        : { bg: "bg-zinc-100", text: "text-zinc-600", label: broadcast.status };

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-white p-3">
      <View className="flex-1">
        <Text className="text-[13px] font-semibold text-fg" numberOfLines={1}>
          {broadcast.title}
        </Text>
        <Text className="mt-0.5 text-[10px] text-muted">
          {broadcast.startedAt
            ? `เริ่ม ${new Date(broadcast.startedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}`
            : broadcast.scheduledAt
              ? `กำหนด ${new Date(broadcast.scheduledAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}`
              : "ยังไม่กำหนดเวลา"}
          {" · "}
          ผู้ชมรวม {broadcast.totalViews.toLocaleString()}
        </Text>
      </View>
      <View className={`rounded-full px-2 py-0.5 ${tone.bg}`}>
        <Text className={`text-[10px] font-semibold ${tone.text}`}>
          {tone.label}
        </Text>
      </View>
      {broadcast.status === "SCHEDULED" ? (
        <Pressable
          onPress={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="rounded-full bg-rose-600 px-3 py-1.5"
        >
          <Text className="text-[11px] font-semibold text-white">
            {startMutation.isPending ? "..." : "เริ่ม"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Silence unused imports for symbols only used inside conditional branches.
void TextInput;
