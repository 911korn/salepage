import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/brand/app-logo";
import { api, ApiClientError } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { formatBaht, orderStatusLabel, formatRelativeTime } from "@/lib/format";
import { useCallback, useState } from "react";

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
  });

  if (authed === null) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  if (!authed) {
    return (
      <Screen>
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
    <Screen>
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
        ) : ordersQuery.data?.orders.length === 0 ? (
          <EmptyState />
        ) : (
          <View className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white">
            {ordersQuery.data?.orders.map((o, i) => (
              <Pressable
                key={o.token}
                onPress={() => router.push(`/o/${o.token}`)}
                className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[14px] font-semibold text-fg" numberOfLines={1}>
                    {o.shopName}
                  </Text>
                  <Text className="text-[14px] font-bold text-brand-700">
                    {formatBaht(o.totalSatang)}
                  </Text>
                </View>
                <View className="mt-1 flex-row items-center justify-between">
                  <Text className="text-[12px] text-muted">
                    {orderStatusLabel(o.status)}
                  </Text>
                  <Text className="text-[11px] text-muted">
                    {formatRelativeTime(o.createdAt)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
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
