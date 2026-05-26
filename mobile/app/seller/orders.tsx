import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { useSellerMode } from "@/store/seller-mode";

type Status = "PENDING" | "PAID" | "SHIPPING" | "DELIVERED" | "CANCELLED";

const STATUS_TABS: Array<{ key: Status; label: string }> = [
  { key: "PENDING", label: "รอตรวจสลิป" },
  { key: "PAID", label: "พร้อมส่ง" },
  { key: "SHIPPING", label: "กำลังส่ง" },
  { key: "DELIVERED", label: "ส่งแล้ว" },
  { key: "CANCELLED", label: "ยกเลิก" },
];

/**
 * /seller/orders — order inbox.
 *
 * Tabbed by status. The default tab is taken from `?status=` query param so
 * the seller home cards can deep-link straight into the right inbox view.
 *
 * Per-order actions:
 *  - PENDING → "อนุมัติ" / "ปฏิเสธ" (PATCH status → PAID/CANCELLED)
 *  - PAID    → "ทำเครื่องหมายว่าจัดส่ง" + tracking input (POST /shipment)
 *  - SHIPPING → "ส่งสำเร็จ" (PATCH status → DELIVERED)
 *
 * All mutations are optimistic-ish: we invalidate the list on settle so the
 * row moves to the right tab automatically without manual refetch.
 */
export default function SellerOrdersScreen() {
  const slug = useSellerMode((s) => s.activeShopSlug);
  const params = useLocalSearchParams<{ status?: string }>();
  const [status, setStatus] = useState<Status>(
    (params.status as Status) || "PENDING",
  );

  const qc = useQueryClient();
  const ordersQuery = useQuery({
    queryKey: ["seller", "orders", slug, status],
    queryFn: () => api.shops.orders(slug!, { status }),
    enabled: Boolean(slug),
    refetchInterval: status === "PENDING" ? 15_000 : 60_000,
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
      {/* Status tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-5 py-3"
      >
        {STATUS_TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setStatus(t.key)}
            className={`rounded-full border px-3 py-1.5 ${
              status === t.key
                ? "border-brand-300 bg-brand-50"
                : "border-border bg-white"
            }`}
          >
            <Text
              className={`text-[12px] font-medium ${
                status === t.key ? "text-brand-700" : "text-fg"
              }`}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerClassName="pb-16"
        refreshControl={
          <RefreshControl
            refreshing={ordersQuery.isFetching}
            onRefresh={() => void ordersQuery.refetch()}
            tintColor="#e11d48"
          />
        }
      >
        {ordersQuery.isLoading ? (
          <View className="py-16">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : ordersQuery.data?.orders.length === 0 ? (
          <View className="mx-5 mt-8 items-center rounded-2xl border border-dashed border-border p-10">
            <Text className="text-[28px]">📭</Text>
            <Text className="mt-2 text-[13px] text-muted">
              ไม่มีคำสั่งซื้อในหมวด &quot;{
                STATUS_TABS.find((t) => t.key === status)?.label
              }&quot;
            </Text>
          </View>
        ) : (
          <View className="gap-3 px-5">
            {ordersQuery.data?.orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                shopSlug={slug}
                onMutated={() => {
                  // Invalidate every status tab — when status flips the row
                  // jumps to a different bucket, so stale tabs need a refresh.
                  void qc.invalidateQueries({
                    queryKey: ["seller", "orders", slug],
                  });
                  // Also refresh stats card on seller home.
                  void qc.invalidateQueries({
                    queryKey: ["seller", "stats", slug],
                  });
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

type OrderRow = NonNullable<
  Awaited<ReturnType<typeof api.shops.orders>>["orders"]
>[number];

function OrderCard({
  order,
  shopSlug,
  onMutated,
}: {
  order: OrderRow;
  shopSlug: string;
  onMutated: () => void;
}) {
  const [trackingInput, setTrackingInput] = useState(
    order.trackingNumber ?? "",
  );
  void shopSlug;

  // Use the public token PATCH route for status changes — same code path the
  // web dashboard uses, so we get the same notifications + audit log.
  const setStatusMutation = useMutation({
    mutationFn: (next: "PAID" | "CANCELLED" | "DELIVERED") =>
      api.orders.setStatus(order.publicToken, next),
    onSuccess: onMutated,
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "อัปเดตล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  const shipMutation = useMutation({
    mutationFn: () =>
      api.orders.markShipping(order.publicToken, {
        trackingNumber: trackingInput.trim() || undefined,
      }),
    onSuccess: onMutated,
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "อัปเดตล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-white">
      {/* Header */}
      <View className="border-b border-border p-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="text-[13px] font-semibold text-fg" numberOfLines={1}>
              {order.customerName}
            </Text>
            {order.customerPhone ? (
              <Text className="mt-0.5 text-[11px] text-muted">
                {order.customerPhone}
              </Text>
            ) : null}
            <Text className="mt-0.5 text-[10px] text-muted">
              #{order.publicToken.slice(-8).toUpperCase()} ·{" "}
              {new Date(order.createdAt).toLocaleString("th-TH", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </Text>
          </View>
          <Text className="text-[16px] font-bold text-brand-700">
            {formatBaht(order.totalSatang)}
          </Text>
        </View>
      </View>

      {/* Items */}
      <View className="gap-2 px-4 py-3">
        {order.items.slice(0, 3).map((it, idx) => (
          <View key={idx} className="flex-row items-center gap-2">
            {it.image ? (
              <Image
                source={{ uri: it.image }}
                style={{ width: 36, height: 36, borderRadius: 8 }}
                contentFit="cover"
              />
            ) : (
              <View className="size-9 rounded-lg bg-soft" />
            )}
            <View className="flex-1">
              <Text className="text-[12px] text-fg" numberOfLines={1}>
                {it.name} × {it.qty}
              </Text>
              <Text className="text-[10px] text-muted">
                {formatBaht(it.priceSatang * it.qty)}
              </Text>
            </View>
          </View>
        ))}
        {order.items.length > 3 ? (
          <Text className="text-[11px] text-muted">
            + อีก {order.items.length - 3} รายการ
          </Text>
        ) : null}
      </View>

      {/* Address (only when shipping is relevant) */}
      {order.customerAddress && order.status !== "PENDING" ? (
        <View className="border-t border-border px-4 py-3">
          <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            ที่อยู่จัดส่ง
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-fg">
            {order.customerAddress}
          </Text>
        </View>
      ) : null}

      {/* Slip preview */}
      {order.slipImageUrl && order.status === "PENDING" ? (
        <Pressable
          onPress={() => router.push(`/o/${order.publicToken}`)}
          className="border-t border-border px-4 py-3"
        >
          <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            สลิปจากลูกค้า
          </Text>
          <Image
            source={{ uri: order.slipImageUrl }}
            style={{
              width: "100%",
              height: 200,
              borderRadius: 12,
              marginTop: 8,
            }}
            contentFit="cover"
          />
        </Pressable>
      ) : null}

      {/* Action bar — content depends on status */}
      <View className="border-t border-border bg-soft/30 p-3">
        {order.status === "PENDING" ? (
          <View className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => {
                Alert.alert("ปฏิเสธคำสั่งซื้อ?", "ลูกค้าจะถูกแจ้งว่ายกเลิก", [
                  { text: "ไม่ยก", style: "cancel" },
                  {
                    text: "ปฏิเสธ",
                    style: "destructive",
                    onPress: () => setStatusMutation.mutate("CANCELLED"),
                  },
                ]);
              }}
              disabled={setStatusMutation.isPending}
            >
              ปฏิเสธ
            </Button>
            <Button
              className="flex-1"
              onPress={() => setStatusMutation.mutate("PAID")}
              disabled={setStatusMutation.isPending}
            >
              ✓ อนุมัติ
            </Button>
          </View>
        ) : order.status === "PAID" ? (
          <View className="gap-2">
            {/* Inline tracking number input — typed value gets passed to the
                ship mutation as `trackingNumber`. Previously this was a
                non-interactive <Text> which silently dropped seller input. */}
            <View className="flex-row items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
              <Text className="text-[11px] text-muted">เลขพัสดุ</Text>
              <TextInput
                value={trackingInput}
                onChangeText={setTrackingInput}
                placeholder="เช่น TH001234567"
                autoCapitalize="characters"
                autoCorrect={false}
                className="flex-1 text-[13px] text-fg"
              />
            </View>
            <Button
              onPress={() => shipMutation.mutate()}
              disabled={shipMutation.isPending}
            >
              📦 ทำเครื่องหมายว่าจัดส่ง
            </Button>
          </View>
        ) : order.status === "SHIPPING" ? (
          <Button
            onPress={() => setStatusMutation.mutate("DELIVERED")}
            disabled={setStatusMutation.isPending}
          >
            ✓ ส่งถึงปลายทางแล้ว
          </Button>
        ) : (
          <Pressable
            onPress={() => router.push(`/o/${order.publicToken}`)}
            className="self-end"
          >
            <Text className="text-[11px] font-semibold text-brand-700">
              ดูรายละเอียด →
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
