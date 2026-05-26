import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react-native";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/brand/app-logo";
import { api, ApiClientError } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { formatBaht, orderStatusLabel, formatRelativeTime } from "@/lib/format";
import { useCallback, useMemo, useState } from "react";

type OrderListItem = {
  token: string;
  status: string;
  shopName: string;
  shopSlug: string;
  totalSatang: number;
  createdAt: string;
};

export default function OrdersScreen() {
  const { t } = useTranslation(["order", "common"]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  // Re-read on focus, not just once on mount — so the modal-based signin
  // flow refreshes the gate after dismissal.
  useFocusEffect(
    useCallback(() => {
      void getAuthToken().then((tok) => setAuthed(Boolean(tok)));
    }, []),
  );

  const ordersQuery = useQuery({
    queryKey: ["me", "orders"],
    queryFn: () => api.me.orders(),
    enabled: authed === true,
    // Refetch on focus so newly-confirmed checkouts appear without a manual
    // pull-to-refresh (911korn 2026-05-27).
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Pin pending payments to the top so the buyer can find the half-finished
  // checkout immediately. Everything else stays in createdAt-desc order
  // (911korn 2026-05-27 IMG_5250 "Order ที่ยังไม่ได้จ่าย หาไม่เจอ").
  const sortedOrders = useMemo(() => {
    const list = ordersQuery.data?.orders ?? [];
    return [...list].sort((a, b) => {
      const aPending = a.status === "PENDING" ? 0 : 1;
      const bPending = b.status === "PENDING" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [ordersQuery.data]);

  // Pull-to-refresh on focus (cheap; query is cached server-side).
  useFocusEffect(
    useCallback(() => {
      if (authed) void ordersQuery.refetch();
    }, [authed, ordersQuery]),
  );

  if (authed === null) {
    return (
      <Screen safeTop>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  if (!authed) {
    return (
      <Screen safeTop>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-[18px] font-semibold text-fg">
            {t("list.guestHeadline")}
          </Text>
          <Text className="mt-1 text-center text-[13px] text-muted">
            {t("list.guestSubtitle")}
          </Text>
          <Button className="mt-6" onPress={() => router.push("/signin?redirect=/orders")}>
            {t("common:auth.signIn")}
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeTop>
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-10">
          <AppLogo size={22} />
          <Text className="mt-3 text-[24px] font-bold text-fg">{t("tabTitle")}</Text>
          <Text className="mt-0.5 text-[13px] text-muted">{t("subtitle")}</Text>
        </View>

        {ordersQuery.isLoading ? (
          <View className="py-12">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : ordersQuery.error ? (
          <ErrorState error={ordersQuery.error} />
        ) : sortedOrders.length === 0 ? (
          <EmptyState />
        ) : (
          <View className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white">
            {sortedOrders.map((o, i) => (
              <OrderRow key={o.token} order={o} showDivider={i > 0} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * One row in the Orders tab. Tapping a PENDING order jumps straight to the
 * checkout screen (where the QR + slip upload live) so the buyer doesn't need
 * to fish for a "Pay now" button on the tracking page. All other statuses
 * navigate to the tracking detail.
 */
function OrderRow({
  order,
  showDivider,
}: {
  order: OrderListItem;
  showDivider: boolean;
}) {
  const isPending = order.status === "PENDING";
  return (
    <Pressable
      onPress={() =>
        router.push(isPending ? `/checkout/${order.token}` : `/o/${order.token}`)
      }
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
      className={`flex-row items-center gap-3 px-4 py-3 ${
        showDivider ? "border-t border-border" : ""
      } ${isPending ? "bg-rose-50/40" : ""}`}
    >
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-[14px] font-semibold text-fg" numberOfLines={1}>
            {order.shopName}
          </Text>
          <Text className="text-[14px] font-bold text-brand-700">
            {formatBaht(order.totalSatang)}
          </Text>
        </View>
        <View className="mt-1 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            {isPending ? (
              <View className="rounded-full bg-rose-600 px-2 py-0.5">
                <Text className="text-[10px] font-bold uppercase text-white">
                  รอชำระเงิน
                </Text>
              </View>
            ) : null}
            <Text className="text-[12px] text-muted">
              {orderStatusLabel(order.status)}
            </Text>
          </View>
          <Text className="text-[11px] text-muted">
            {formatRelativeTime(order.createdAt)}
          </Text>
        </View>
      </View>
      <ChevronRight size={18} color="#9ca3af" />
    </Pressable>
  );
}

function EmptyState() {
  const { t } = useTranslation("order");
  return (
    <View className="mx-5 mt-6 rounded-3xl border border-dashed border-border bg-white p-8">
      <Text className="text-center text-[15px] font-semibold text-fg">
        {t("list.empty")}
      </Text>
      <Text className="mt-1 text-center text-[12px] text-muted">
        {t("list.emptyHint")}
      </Text>
    </View>
  );
}

function ErrorState({ error }: { error: unknown }) {
  const { t } = useTranslation("order");
  const msg =
    error instanceof ApiClientError ? error.message : t("list.loadFailed");
  return (
    <View className="mx-5 mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6">
      <Text className="text-center text-[14px] text-rose-700">{msg}</Text>
    </View>
  );
}
