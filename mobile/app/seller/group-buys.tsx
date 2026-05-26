import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { useSellerMode } from "@/store/seller-mode";

/**
 * /seller/group-buys — campaign control panel.
 *
 * Shows the same list the buyer-side rail consumes (ACTIVE + recently-filled),
 * with owner-only Cancel action on ACTIVE rows. Tap a row to deep-link into
 * the buyer-facing detail screen so the seller can preview exactly what
 * customers see.
 */
export default function SellerGroupBuysScreen() {
  const activeSlug = useSellerMode((s) => s.activeShopSlug);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["seller", "group-buys", activeSlug],
    queryFn: () => api.groupBuy.forShop(activeSlug!),
    enabled: Boolean(activeSlug),
    refetchInterval: 15_000,
  });

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

  const campaigns = query.data?.groupBuys ?? [];

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Group Buy · V2.0
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            แคมเปญรวมซื้อของร้าน
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            เปิดให้ลูกค้ารวมซื้อ — ยิ่งหลายคนซื้อ ยิ่งราคาถูกลง
            เหมาะกับสินค้าที่ผลิตเป็นล็อต หรือมี MOQ ขั้นต่ำ
          </Text>
        </View>

        {query.isLoading ? (
          <View className="py-8">
            <ActivityIndicator color="#10b981" />
          </View>
        ) : campaigns.length === 0 ? (
          <View className="mx-5 mt-8 items-center rounded-3xl border border-dashed border-border p-8">
            <Text className="text-[28px]">🧧</Text>
            <Text className="mt-2 text-[14px] font-semibold text-fg">
              ยังไม่มีแคมเปญ
            </Text>
            <Text className="mt-1 text-center text-[11px] text-muted">
              สร้างแคมเปญแรก — ตั้งราคาตามจำนวน เพื่อกระตุ้นการรวมซื้อ
            </Text>
          </View>
        ) : (
          <View className="mx-5 mt-5 gap-2">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              ทั้งหมด ({campaigns.length})
            </Text>
            {campaigns.map((gb) => (
              <CampaignRow
                key={gb.id}
                campaign={gb}
                onChanged={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["seller", "group-buys", activeSlug],
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white p-4">
        <Button onPress={() => router.push("/seller/group-buys/new")}>
          + สร้างแคมเปญใหม่
        </Button>
      </View>
    </Screen>
  );
}

function CampaignRow({
  campaign,
  onChanged,
}: {
  campaign: NonNullable<
    Awaited<ReturnType<typeof api.groupBuy.forShop>>
  >["groupBuys"][number];
  onChanged: () => void;
}) {
  const cancelMutation = useMutation({
    mutationFn: () => api.groupBuy.cancel(campaign.id),
    onSuccess: () => onChanged(),
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "ยกเลิกไม่สำเร็จ";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  const tone =
    campaign.status === "ACTIVE"
      ? { bg: "bg-rose-50", text: "text-rose-700", label: "🔥 LIVE" }
      : campaign.status === "FILLED"
        ? {
            bg: "bg-emerald-50",
            text: "text-emerald-700",
            label: "✓ เต็มแล้ว",
          }
        : { bg: "bg-zinc-100", text: "text-zinc-600", label: campaign.status };

  const progressPct = Math.min(
    100,
    (campaign.currentQty / campaign.minQty) * 100,
  );

  return (
    <View className="rounded-2xl border border-border bg-white p-3">
      <Pressable
        onPress={() => router.push(`/group-buy/${campaign.id}`)}
        className="flex-row items-center gap-3"
      >
        <View className="size-14 overflow-hidden rounded-xl bg-soft">
          {campaign.product.imageUrls?.[0] ? (
            <Image
              source={{ uri: campaign.product.imageUrls[0] }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : null}
        </View>
        <View className="flex-1">
          <Text className="text-[13px] font-semibold text-fg" numberOfLines={1}>
            {campaign.title}
          </Text>
          <Text className="text-[11px] text-muted" numberOfLines={1}>
            {campaign.product.name} · {formatBaht(campaign.currentPriceSatang)}
          </Text>
          <View className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-100">
            <View
              className="h-full bg-emerald-500"
              style={{ width: `${progressPct}%` }}
            />
          </View>
          <Text className="mt-1 text-[10px] text-muted">
            {campaign.currentQty} / {campaign.minQty} ชิ้น ·{" "}
            {campaign.status === "ACTIVE"
              ? countdown(campaign.deadline)
              : campaign.status === "FILLED"
                ? "พร้อมจัดส่ง"
                : "ปิดแล้ว"}
          </Text>
        </View>
        <View className={`self-start rounded-full px-2 py-0.5 ${tone.bg}`}>
          <Text className={`text-[10px] font-semibold ${tone.text}`}>
            {tone.label}
          </Text>
        </View>
      </Pressable>

      {campaign.status === "ACTIVE" ? (
        <Pressable
          onPress={() => {
            Alert.alert(
              "ยกเลิกแคมเปญ?",
              "ออเดอร์ของลูกค้าที่ join แล้วจะถูกยกเลิกอัตโนมัติ + คืนเงินถ้ามี escrow",
              [
                { text: "ไม่", style: "cancel" },
                {
                  text: "ยกเลิกแคมเปญ",
                  style: "destructive",
                  onPress: () => cancelMutation.mutate(),
                },
              ],
            );
          }}
          disabled={cancelMutation.isPending}
          className="mt-2 self-end rounded-full border border-rose-200 bg-white px-3 py-1.5"
        >
          <Text className="text-[11px] font-semibold text-rose-700">
            {cancelMutation.isPending ? "..." : "ยกเลิกแคมเปญ"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function countdown(iso: string): string {
  const remainMs = new Date(iso).getTime() - Date.now();
  if (remainMs <= 0) return "หมดเวลา";
  const days = Math.floor(remainMs / 86_400_000);
  if (days >= 1) return `เหลือ ${days} วัน`;
  const hours = Math.floor(remainMs / 3_600_000);
  if (hours >= 1) return `เหลือ ${hours} ชม.`;
  const mins = Math.max(1, Math.floor(remainMs / 60_000));
  return `เหลือ ${mins} นาที`;
}
