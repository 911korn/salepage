import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatBaht } from "@/lib/format";

/**
 * /me/wallet — cross-shop loyalty wallet aggregator.
 *
 * Buyer-facing summary of every shop where they've accumulated points.
 * Each row tap opens the shop's storefront — that's where you actually
 * burn the points (in checkout), so we route there rather than show a
 * per-shop wallet detail screen.
 */
export default function WalletScreen() {
  const { t } = useTranslation(["meSub", "common"]);
  const walletQuery = useQuery({
    queryKey: ["me", "wallet"],
    queryFn: () => api.me.wallet(),
  });

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-16"
        refreshControl={
          <RefreshControl
            refreshing={walletQuery.isFetching}
            onRefresh={() => void walletQuery.refetch()}
            tintColor="#e11d48"
          />
        }
      >
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t("wallet.title")}
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            {t("wallet.heroLabel")}
          </Text>
        </View>

        {walletQuery.isLoading ? (
          <View className="py-16">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : walletQuery.data?.totals.shopCount === 0 ? (
          <View className="mx-5 mt-8 items-center rounded-3xl border border-dashed border-border p-8">
            <Text className="text-[28px]">💎</Text>
            <Text className="mt-2 text-[14px] font-semibold text-fg">
              {t("wallet.empty")}
            </Text>
            <Text className="mt-1 text-center text-[11px] text-muted">
              {t("wallet.emptyHint")}
            </Text>
            <Button
              variant="outline"
              className="mt-4"
              onPress={() => router.replace("/")}
            >
              {t("wallet.openShop")}
            </Button>
          </View>
        ) : (
          <>
            {/* Totals header card */}
            <View className="mx-5 mt-4 rounded-3xl bg-brand-600 p-5">
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-brand-100">
                {t("wallet.heroLabel")}
              </Text>
              <Text className="mt-1 text-[32px] font-bold text-white">
                {t("wallet.heroValue", {
                  points: walletQuery.data!.totals.totalPoints.toLocaleString(),
                })}
              </Text>
              <View className="mt-3 flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-[10px] uppercase tracking-wider text-brand-100">
                    {t("wallet.shopsLabel")}
                  </Text>
                  <Text className="text-[15px] font-semibold text-white">
                    {walletQuery.data!.totals.shopCount}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] uppercase tracking-wider text-brand-100">
                    {t("wallet.totalSpentLabel")}
                  </Text>
                  <Text className="text-[15px] font-semibold text-white">
                    {formatBaht(walletQuery.data!.totals.totalSpentSatang)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Per-shop rows */}
            <View className="mt-4 gap-2 px-5">
              {walletQuery.data!.wallets.map((w) => (
                <Pressable
                  key={`${w.shop.id}-${w.customerPhone}`}
                  onPress={() => router.push(`/s/${w.shop.slug}`)}
                  className="flex-row items-center gap-3 rounded-2xl border border-border bg-white p-4"
                >
                  <View
                    className="size-12 items-center justify-center overflow-hidden rounded-xl"
                    style={{ backgroundColor: w.shop.themeColor }}
                  >
                    {w.shop.logoUrl ? (
                      <Image
                        source={{ uri: w.shop.logoUrl }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <Text className="text-[16px] font-bold text-white">
                        {w.shop.logoText ?? w.shop.name.slice(0, 1)}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-[14px] font-semibold text-fg"
                      numberOfLines={1}
                    >
                      {w.shop.name}
                    </Text>
                    <Text className="mt-0.5 text-[11px] text-muted">
                      {t("wallet.totalSpent", { baht: formatBaht(w.totalSpentSatang) })}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[16px] font-bold text-brand-700">
                      {w.points.toLocaleString()} pt
                    </Text>
                    <Text className="text-[10px] text-muted">
                      ≈ {formatBaht(w.points * 100)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View className="mx-5 mt-4 rounded-2xl border border-dashed border-border p-4">
              <Text className="text-[11px] leading-relaxed text-muted">
                {t("wallet.autoApplyHint")}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
