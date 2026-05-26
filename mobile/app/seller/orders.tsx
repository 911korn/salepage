import { memo, useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
  type ListRenderItem,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { api, ApiClientError } from "@/lib/api";
import { formatBaht, orderStatusLabel } from "@/lib/format";
import { useSellerMode } from "@/store/seller-mode";

type Status = "PENDING" | "PAID" | "SHIPPING" | "DELIVERED" | "CANCELLED";

const STATUS_TAB_KEYS: Status[] = [
  "PENDING",
  "PAID",
  "SHIPPING",
  "DELIVERED",
  "CANCELLED",
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
  const { t } = useTranslation(["seller", "common"]);
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
          <Text className="text-center text-fg">{t("home.pickShopHint")}</Text>
          <Button
            variant="outline"
            className="mt-4"
            onPress={() => router.replace("/seller")}
          >
            {t("home.back")}
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Status tabs — horizontal scroller. Wrap with `flexGrow: 0` so
          the ScrollView sizes to its content height instead of greedily
          stretching to fill the parent flex-1 column (which made each
          rounded-full pill render as a tall vertical bar — 911korn
          2026-05-27 screenshots IMG_5223–5226). */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerClassName="gap-2 px-5 py-3"
      >
        {STATUS_TAB_KEYS.map((tabKey) => (
          <Pressable
            key={tabKey}
            onPress={() => setStatus(tabKey)}
            className={`self-start rounded-full border px-3 py-1.5 ${
              status === tabKey
                ? "border-brand-300 bg-brand-50"
                : "border-border bg-white"
            }`}
          >
            <Text
              className={`text-[12px] font-medium ${
                status === tabKey ? "text-brand-700" : "text-fg"
              }`}
            >
              {t(`orders.tabs.${tabKey}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <SellerOrdersList
        orders={ordersQuery.data?.orders ?? []}
        isLoading={ordersQuery.isLoading}
        isFetching={ordersQuery.isFetching}
        onRefresh={() => void ordersQuery.refetch()}
        emptyLabel={t("orders.empty", { label: t(`orders.tabs.${status}`) })}
        slug={slug}
        onMutated={() => {
          void qc.invalidateQueries({ queryKey: ["seller", "orders", slug] });
          void qc.invalidateQueries({ queryKey: ["seller", "stats", slug] });
        }}
      />
    </Screen>
  );
}

type OrderRow = NonNullable<
  Awaited<ReturnType<typeof api.shops.orders>>["orders"]
>[number];

/**
 * Virtualised order list. OrderCard contains image + text + actions —
 * rendering 30+ via .map() in a ScrollView (the old way) janked the
 * status-tab switch + scroll. FlatList with removeClippedSubviews +
 * windowed rendering keeps the seller inbox at 60 fps even with 100+
 * orders in a single tab.
 */
function SellerOrdersListImpl({
  orders,
  isLoading,
  isFetching,
  onRefresh,
  emptyLabel,
  slug,
  onMutated,
}: {
  orders: OrderRow[];
  isLoading: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  emptyLabel: string;
  slug: string;
  onMutated: () => void;
}) {
  const renderItem: ListRenderItem<OrderRow> = useCallback(
    ({ item }) => (
      <View className="mb-3">
        <OrderCard order={item} shopSlug={slug} onMutated={onMutated} />
      </View>
    ),
    [slug, onMutated],
  );

  return (
    <FlatList
      data={orders}
      keyExtractor={(o) => o.id}
      renderItem={renderItem}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 64 }}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={onRefresh}
          tintColor="#e11d48"
        />
      }
      ListEmptyComponent={
        isLoading ? (
          <View className="py-16">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : (
          <View className="mt-8 items-center rounded-2xl border border-dashed border-border p-10">
            <Text className="text-[28px]">📭</Text>
            <Text className="mt-2 text-[13px] text-muted">{emptyLabel}</Text>
          </View>
        )
      }
      removeClippedSubviews
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={9}
      showsVerticalScrollIndicator={false}
    />
  );
}
const SellerOrdersList = memo(SellerOrdersListImpl);

const OrderCard = memo(function OrderCard({
  order,
  shopSlug,
  onMutated,
}: {
  order: OrderRow;
  shopSlug: string;
  onMutated: () => void;
}) {
  const { t } = useTranslation("seller");
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
      const msg = e instanceof ApiClientError ? e.message : t("orders.errorBody");
      Alert.alert(t("orders.errorTitle"), msg);
    },
  });

  const shipMutation = useMutation({
    mutationFn: () =>
      api.orders.markShipping(order.publicToken, {
        trackingNumber: trackingInput.trim() || undefined,
      }),
    onSuccess: onMutated,
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : t("orders.errorBody");
      Alert.alert(t("orders.errorTitle"), msg);
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
            + {order.items.length - 3}
          </Text>
        ) : null}
      </View>

      {/* Address (only when shipping is relevant) */}
      {order.customerAddress && order.status !== "PENDING" ? (
        <View className="border-t border-border px-4 py-3">
          <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {t("orders.shippingAddress")}
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
            {t("orders.slipFromBuyer")}
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
                Alert.alert(t("orders.rejectTitle"), t("orders.rejectBody"), [
                  { text: t("orders.rejectKeep"), style: "cancel" },
                  {
                    text: t("orders.reject"),
                    style: "destructive",
                    onPress: () => setStatusMutation.mutate("CANCELLED"),
                  },
                ]);
              }}
              disabled={setStatusMutation.isPending}
            >
              {t("orders.reject")}
            </Button>
            <Button
              className="flex-1"
              onPress={() => setStatusMutation.mutate("PAID")}
              disabled={setStatusMutation.isPending}
            >
              {t("orders.approve")}
            </Button>
          </View>
        ) : order.status === "PAID" ? (
          <View className="gap-2">
            <View className="flex-row items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
              <Text className="text-[11px] text-muted">{t("orders.trackingLabel")}</Text>
              <TextInput
                value={trackingInput}
                onChangeText={setTrackingInput}
                placeholder={t("orders.trackingPlaceholder")}
                autoCapitalize="characters"
                autoCorrect={false}
                className="flex-1 text-[13px] text-fg"
              />
            </View>
            <Button
              onPress={() => shipMutation.mutate()}
              disabled={shipMutation.isPending}
            >
              {t("orders.markShipped")}
            </Button>
          </View>
        ) : order.status === "SHIPPING" ? (
          <Button
            onPress={() => setStatusMutation.mutate("DELIVERED")}
            disabled={setStatusMutation.isPending}
          >
            {t("orders.markDelivered")}
          </Button>
        ) : (
          <Pressable
            onPress={() => router.push(`/o/${order.publicToken}`)}
            className="self-end"
          >
            <Text className="text-[11px] font-semibold text-brand-700">
              {t("orders.viewDetail")}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});
