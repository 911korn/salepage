import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { getActiveReferrer } from "@/lib/affiliate";

/**
 * /group-buy/[id] — buyer detail + join screen.
 *
 * Layout:
 *   1. Product card with current tier price + progress bar
 *   2. Tier table (when tiers > 0) so buyers see future discounts
 *   3. Countdown timer
 *   4. Quantity selector + customer form
 *   5. "Join + share" CTA (composes a Share intent prefilled with deep link)
 */
export default function GroupBuyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Tick the local clock once per second so the countdown is smooth.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);

  const query = useQuery({
    queryKey: ["groupBuy", id],
    queryFn: () => api.groupBuy.get(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });

  const [qty, setQty] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const join = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("");
      const ref = await getActiveReferrer();
      return api.groupBuy.join(id, {
        qty,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        referrerUserId: ref?.userId,
        referrerCode: ref?.code,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["groupBuy", id] });
      router.replace(`/checkout/${res.orderToken}`);
    },
    onError: (err) => {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : "เข้าร่วม Group Buy ไม่สำเร็จ";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  const data = query.data?.groupBuy;
  const remaining = useMemo(() => {
    if (!data) return null;
    const ms = new Date(data.deadline).getTime() - now;
    return ms > 0 ? ms : 0;
  }, [data, now]);

  if (query.isLoading || !data) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#10b981" />
        </View>
      </Screen>
    );
  }

  const progressPct = Math.min(100, (data.currentQty / data.minQty) * 100);
  const isActive = data.status === "ACTIVE" && (remaining ?? 0) > 0;

  return (
    <Screen scroll>
      {/* Hero image */}
      <View className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white">
        <View className="aspect-square w-full bg-soft">
          {data.product.imageUrls?.[0] ? (
            <Image
              source={{ uri: data.product.imageUrls[0] }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : null}
          <View
            className={`absolute right-3 top-3 rounded-full px-2.5 py-1 ${
              data.status === "FILLED"
                ? "bg-emerald-600"
                : data.status === "ACTIVE"
                  ? "bg-rose-600"
                  : "bg-zinc-500"
            }`}
          >
            <Text className="text-[10px] font-bold uppercase text-white">
              {data.status === "FILLED"
                ? "✓ เต็มแล้ว"
                : data.status === "ACTIVE"
                  ? "🔥 LIVE"
                  : data.status}
            </Text>
          </View>
        </View>
        <View className="p-5">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
            🧧 GROUP BUY
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            {data.title}
          </Text>
          <Text className="mt-1 text-[13px] text-muted">{data.product.name}</Text>

          {/* Price block */}
          <View className="mt-3 flex-row items-baseline gap-2">
            <Text className="text-[28px] font-bold text-rose-700">
              {formatBaht(data.currentPriceSatang)}
            </Text>
            {data.product.priceSatang > data.currentPriceSatang ? (
              <Text className="text-[13px] text-muted line-through">
                {formatBaht(data.product.priceSatang)}
              </Text>
            ) : null}
          </View>
          {data.nextTier ? (
            <Text className="mt-1 text-[12px] text-emerald-700">
              ⬇ ลดเหลือ {formatBaht(data.nextTier.priceSatang)} เมื่อรวม{" "}
              {data.nextTier.minQty} ชิ้น
            </Text>
          ) : null}

          {/* Progress */}
          <View className="mt-4">
            <View className="h-2 overflow-hidden rounded-full bg-zinc-100">
              <View
                className="h-full bg-emerald-500"
                style={{ width: `${progressPct}%` }}
              />
            </View>
            <Text className="mt-1.5 text-[12px] text-muted">
              {data.currentQty} / {data.minQty} ชิ้น
              {data.maxQty ? ` · เพดาน ${data.maxQty}` : ""} ·{" "}
              {data.status === "FILLED"
                ? "พร้อมจัดส่ง 🎉"
                : data.status === "ACTIVE"
                  ? humanCountdown(remaining ?? 0)
                  : "หมดเวลาแล้ว"}
            </Text>
          </View>

          {/* Tier table */}
          {data.tiers.length > 0 ? (
            <View className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                ตารางส่วนลดตามจำนวน
              </Text>
              {data.tiers.map((t, idx) => {
                const reached = data.currentQty >= t.minQty;
                return (
                  <View
                    key={idx}
                    className={`mt-2 flex-row items-center justify-between rounded-xl px-3 py-2 ${
                      reached ? "bg-emerald-100" : "bg-white"
                    }`}
                  >
                    <Text className="text-[12px] text-fg">
                      ≥ {t.minQty} ชิ้น
                    </Text>
                    <Text
                      className={`text-[13px] font-bold ${
                        reached ? "text-emerald-700" : "text-fg"
                      }`}
                    >
                      {formatBaht(t.priceSatang)}
                      {reached ? " ✓" : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {data.description ? (
            <Text className="mt-4 text-[13px] leading-relaxed text-fg">
              {data.description}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Share */}
      <Pressable
        onPress={async () => {
          try {
            await Share.share({
              message: `🧧 ${data.title}\nรวมซื้อ ${data.currentQty}/${data.minQty} ชิ้น — ${formatBaht(data.currentPriceSatang)} เท่านั้น\nhttps://salepage.app/group-buy/${data.id}`,
            });
          } catch {
            /* user cancelled */
          }
        }}
        className="mx-5 mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 py-3"
      >
        <Text className="text-[14px] font-semibold text-emerald-700">
          📣 แชร์ชวนเพื่อนช่วยฟิล
        </Text>
      </Pressable>

      {/* Join form */}
      {isActive ? (
        <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
          <Text className="text-[13px] font-semibold uppercase tracking-wider text-muted">
            เข้าร่วม Group Buy
          </Text>
          <View className="mt-3 flex-row items-center gap-3">
            <Text className="text-[13px] text-muted">จำนวน</Text>
            <View className="flex-row items-center gap-3">
              <QtyButton onPress={() => setQty(Math.max(1, qty - 1))} label="−" />
              <Text className="min-w-7 text-center text-[16px] font-bold">
                {qty}
              </Text>
              <QtyButton
                onPress={() =>
                  setQty(Math.min(data.maxQty ?? 50, qty + 1))
                }
                label="+"
              />
            </View>
            <Text className="ml-auto text-[14px] font-bold text-rose-700">
              {formatBaht(data.currentPriceSatang * qty)}
            </Text>
          </View>
          <FieldInput
            label="ชื่อ-นามสกุล *"
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="เช่น สมชาย ใจดี"
          />
          <FieldInput
            label="เบอร์โทร"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder="08x-xxx-xxxx"
            keyboardType="phone-pad"
          />
          <FieldInput
            label="ที่อยู่จัดส่ง"
            value={customerAddress}
            onChangeText={setCustomerAddress}
            placeholder="บ้านเลขที่ ถนน เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
            multiline
          />
        </View>
      ) : (
        <View className="mx-5 mt-4 rounded-3xl border border-dashed border-border bg-white p-5">
          <Text className="text-center text-[14px] text-muted">
            Group Buy นี้{" "}
            {data.status === "FILLED"
              ? "เต็มแล้ว — สั่งซื้อปกติได้จากหน้าสินค้า"
              : "ปิดแล้ว"}
          </Text>
        </View>
      )}

      <View className="px-5 pt-4 pb-12">
        {isActive ? (
          <Button
            loading={join.isPending}
            disabled={join.isPending || customerName.trim().length < 2}
            onPress={() => join.mutate()}
          >
            เข้าร่วม + จ่ายเงิน {formatBaht(data.currentPriceSatang * qty)}
          </Button>
        ) : (
          <Button
            variant="outline"
            onPress={() => router.push(`/s/${data.product.slug}`)}
          >
            ดูสินค้า
          </Button>
        )}
      </View>
    </Screen>
  );
}

function QtyButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      className="size-9 items-center justify-center rounded-xl border border-border bg-soft"
    >
      <Text className="text-[18px] font-bold text-fg">{label}</Text>
    </Pressable>
  );
}

function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View className="mt-3">
      <Text className="text-[12px] text-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        className={`mt-1 rounded-xl border border-border bg-white px-3 py-2 text-[15px] text-fg ${
          multiline ? "min-h-[80px]" : ""
        }`}
        textAlignVertical={multiline ? "top" : "auto"}
      />
    </View>
  );
}

/** "เหลือ 02:14:55" / "เหลือ 02:33 น." style countdown. */
function humanCountdown(ms: number): string {
  if (ms <= 0) return "หมดเวลา";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `เหลือ ${days} วัน ${hours % 24} ชม.`;
  }
  return `เหลือ ${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
