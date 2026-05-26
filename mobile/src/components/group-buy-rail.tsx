import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { api } from "@/lib/api";
import { formatBaht } from "@/lib/format";

/**
 * Per-shop Group Buy rail. Renders on the shop detail page just below the
 * shop trust/protected pay block. Self-hides when the shop has no campaigns.
 *
 * Each card shows the live progress (joined/min), a small countdown, and
 * the current tier price. Tapping opens the dedicated join screen at
 * `/group-buy/[id]`.
 */
export function GroupBuyRail({ shopSlug }: { shopSlug: string }) {
  const query = useQuery({
    queryKey: ["groupBuy", "forShop", shopSlug],
    queryFn: () => api.groupBuy.forShop(shopSlug),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (!query.data || query.data.groupBuys.length === 0) return null;

  return (
    <View className="mt-4">
      <View className="px-5">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
          🧧 Group Buy เปิดอยู่
        </Text>
        <Text className="mt-0.5 text-[14px] font-bold text-fg">
          ซื้อรวมกันยิ่งถูก
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 py-3 gap-3"
      >
        {query.data.groupBuys.map((gb) => (
          <Pressable
            key={gb.id}
            onPress={() => router.push(`/group-buy/${gb.id}`)}
            className="w-60 overflow-hidden rounded-2xl border border-emerald-200 bg-white"
          >
            <View className="aspect-square w-full bg-soft">
              {gb.product.imageUrls?.[0] ? (
                <Image
                  source={{ uri: gb.product.imageUrls[0] }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : null}
              {gb.status === "FILLED" ? (
                <View className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5">
                  <Text className="text-[10px] font-bold uppercase text-white">
                    ✓ เต็มแล้ว
                  </Text>
                </View>
              ) : (
                <View className="absolute right-2 top-2 rounded-full bg-rose-600 px-2 py-0.5">
                  <Text className="text-[10px] font-bold uppercase text-white">
                    🔥 LIVE
                  </Text>
                </View>
              )}
            </View>
            <View className="p-3">
              <Text className="text-[13px] font-semibold text-fg" numberOfLines={2}>
                {gb.title}
              </Text>
              <View className="mt-1 flex-row items-baseline gap-1.5">
                <Text className="text-[16px] font-bold text-rose-700">
                  {formatBaht(gb.currentPriceSatang)}
                </Text>
                {gb.product.priceSatang > gb.currentPriceSatang ? (
                  <Text className="text-[11px] text-muted line-through">
                    {formatBaht(gb.product.priceSatang)}
                  </Text>
                ) : null}
              </View>
              <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <View
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (gb.currentQty / gb.minQty) * 100,
                    )}%`,
                  }}
                />
              </View>
              <Text className="mt-1 text-[10px] text-muted">
                {gb.currentQty} / {gb.minQty} ชิ้น ·{" "}
                {gb.status === "FILLED"
                  ? "พร้อมจัดส่ง"
                  : countdown(gb.deadline)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Compact countdown like "เหลือ 2 ชม." / "เหลือ 3 ว." */
function countdown(iso: string): string {
  const remainMs = new Date(iso).getTime() - Date.now();
  if (remainMs <= 0) return "หมดเวลา";
  const days = Math.floor(remainMs / 86_400_000);
  if (days >= 1) return `เหลือ ${days} ว.`;
  const hours = Math.floor(remainMs / 3_600_000);
  if (hours >= 1) return `เหลือ ${hours} ชม.`;
  const mins = Math.max(1, Math.floor(remainMs / 60_000));
  return `เหลือ ${mins} นาที`;
}
