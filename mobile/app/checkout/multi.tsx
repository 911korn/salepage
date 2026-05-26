import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, router, Link } from "expo-router";
import { useQueries } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatBaht } from "@/lib/format";

/**
 * /checkout/multi?tokens=t1,t2,t3
 *
 * Lands here after the cart confirms a multi-shop order. We render one row
 * per order with its current status + a "settle" button that drops the user
 * into the existing /checkout/[token] flow for that shop.
 *
 * Status comes from the per-order endpoint so this screen stays correct even
 * if the user backs out, settles one shop, and returns later — each order
 * tracks its own slip state independently.
 */
export default function CheckoutMultiScreen() {
  const params = useLocalSearchParams<{ tokens?: string }>();
  const tokens = useMemo(() => {
    if (!params.tokens) return [];
    return params.tokens
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }, [params.tokens]);

  // Fetch each order in parallel; keep them separate so a single 404 doesn't
  // black-out the whole screen.
  const queries = useQueries({
    queries: tokens.map((token) => ({
      queryKey: ["order", token],
      queryFn: () => api.orders.get(token),
      // Auto-refresh every 8s so a tab settled in another window updates here.
      refetchInterval: 8_000,
    })),
  });

  if (tokens.length === 0) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-fg">ไม่พบรายการชำระเงิน</Text>
          <Button className="mt-4" variant="outline" onPress={() => router.replace("/")}>
            กลับหน้าแรก
          </Button>
        </View>
      </Screen>
    );
  }

  const allLoaded = queries.every((q) => q.data || q.error);
  const totalSatang = queries.reduce(
    (sum, q) => (q.data ? sum + q.data.totalSatang : sum),
    0,
  );
  const settledCount = queries.filter(
    (q) => q.data && q.data.status !== "PENDING",
  ).length;

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            จ่ายแยกตามร้าน
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            {tokens.length} ร้าน · {formatBaht(totalSatang)}
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            แต่ละร้านจะมี QR PromptPay ของร้านเอง — ระบบส่งเงินตรงเข้าร้านโดยไม่หักค่าธรรมเนียม
          </Text>
        </View>

        {!allLoaded ? (
          <View className="py-10">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : (
          <View className="mt-4 gap-3 px-5">
            {queries.map((q, i) => (
              <OrderRow key={tokens[i]} token={tokens[i]!} query={q} index={i} />
            ))}
          </View>
        )}

        {allLoaded && settledCount === tokens.length ? (
          <View className="mx-5 mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <Text className="text-[14px] font-semibold text-emerald-800">
              จ่ายครบทุกร้านแล้ว 🎉
            </Text>
            <Text className="mt-1 text-[12px] text-emerald-700">
              ติดตามสถานะการจัดส่งได้ที่ &quot;คำสั่งซื้อของฉัน&quot;
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky bottom: jump to "My Orders" once everything is settled */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white px-4 py-3 pb-6">
        {allLoaded && settledCount === tokens.length ? (
          <Button onPress={() => router.replace("/orders")}>
            ดูคำสั่งซื้อทั้งหมด ({tokens.length})
          </Button>
        ) : (
          <Button
            variant="outline"
            onPress={() => {
              Alert.alert(
                "ออกจากหน้าชำระเงิน?",
                "คำสั่งซื้อจะอยู่ในระบบ คุณสามารถกลับมาจ่ายภายหลังผ่าน 'คำสั่งซื้อของฉัน'",
                [
                  { text: "ยังไม่ออก", style: "cancel" },
                  {
                    text: "ออก",
                    style: "destructive",
                    onPress: () => router.replace("/"),
                  },
                ],
              );
            }}
          >
            จ่ายภายหลัง
          </Button>
        )}
      </View>
    </Screen>
  );
}

function OrderRow({
  token,
  query,
  index,
}: {
  token: string;
  // Loose typing here — useQueries infers a union but we only read shape.
  query: { data?: Awaited<ReturnType<typeof api.orders.get>>; error?: unknown };
  index: number;
}) {
  const order = query.data;
  const error = query.error;
  if (error) {
    return (
      <View className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <Text className="text-[13px] font-semibold text-rose-800">
          ร้านที่ {index + 1} โหลดไม่สำเร็จ
        </Text>
        <Text className="mt-1 text-[12px] text-rose-700" numberOfLines={2}>
          {error instanceof Error ? error.message : "ไม่ทราบสาเหตุ"}
        </Text>
      </View>
    );
  }
  if (!order) {
    return (
      <View className="rounded-2xl border border-border bg-white p-4">
        <ActivityIndicator color="#e11d48" />
      </View>
    );
  }

  const isSettled = order.status !== "PENDING";
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;
  const statusColor = STATUS_COLORS[order.status] ?? "text-muted";

  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-white">
      <View className="flex-row items-center gap-3 p-4">
        <View
          className="size-12 items-center justify-center overflow-hidden rounded-xl"
          style={{ backgroundColor: order.shop.themeColor }}
        >
          <Text className="text-[16px] font-bold text-white">
            {order.shop.logoText ?? order.shop.name.slice(0, 1)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-[14px] font-semibold text-fg" numberOfLines={1}>
            {order.shop.name}
          </Text>
          <Text className="mt-0.5 text-[12px] text-muted">
            {order.items.length} รายการ · {formatBaht(order.totalSatang)}
          </Text>
        </View>
        <Text className={`text-[12px] font-semibold ${statusColor}`}>
          {statusLabel}
        </Text>
      </View>

      <View className="border-t border-border bg-soft/30 px-4 py-3">
        {isSettled ? (
          <Pressable
            onPress={() => router.push(`/o/${order.publicToken}`)}
            className="flex-row items-center justify-between"
          >
            <Text className="text-[12px] text-muted">ดูสถานะคำสั่งซื้อนี้</Text>
            <Text className="text-[12px] font-semibold text-brand-700">→</Text>
          </Pressable>
        ) : (
          <Link href={`/checkout/${token}`} asChild>
            <Pressable className="flex-row items-center justify-between">
              <Text className="text-[12px] font-semibold text-fg">
                สแกน QR และอัปโหลดสลิป
              </Text>
              <Text className="text-[12px] font-semibold text-brand-700">
                ชำระเงิน →
              </Text>
            </Pressable>
          </Link>
        )}
      </View>
    </View>
  );
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอชำระ",
  PAID: "ชำระแล้ว",
  SHIPPING: "กำลังจัดส่ง",
  DELIVERED: "ส่งสำเร็จ",
  CANCELLED: "ยกเลิก",
  REFUNDED: "คืนเงิน",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-amber-600",
  PAID: "text-emerald-600",
  SHIPPING: "text-blue-600",
  DELIVERED: "text-emerald-700",
  CANCELLED: "text-rose-600",
  REFUNDED: "text-rose-600",
};
