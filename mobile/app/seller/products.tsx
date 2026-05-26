import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
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
import { useSellerMode } from "@/store/seller-mode";

/**
 * /seller/products — seller product list.
 *
 * Tap a row → /seller/products/[productSlug]/edit (in-app edit flow,
 * 911korn 2026-05-27 directive: "ไม่เอา Edit on Web ต้องการให้ Add
 * Product Edit Product จัดการทุกอย่างได้ผ่าน App ทั้งหมดเลย").
 * "+ Add product" → /seller/products/new.
 */
export default function SellerProductsScreen() {
  const { t } = useTranslation(["seller", "shop"]);
  const slug = useSellerMode((s) => s.activeShopSlug);

  const shopQuery = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => api.shop.get(slug!),
    enabled: Boolean(slug),
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

  const products = shopQuery.data?.products ?? [];

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-16"
        refreshControl={
          <RefreshControl
            refreshing={shopQuery.isFetching}
            onRefresh={() => void shopQuery.refetch()}
            tintColor="#e11d48"
          />
        }
      >
        {/* Header + create button */}
        <View className="px-5 pt-6">
          <Text className="text-[20px] font-bold text-fg">
            {t("products.header", { name: shopQuery.data?.shop.name ?? "" })}
          </Text>
          <Text className="mt-1 text-[12px] text-muted">
            {t("products.subtitle", { count: products.length })}
          </Text>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => router.push("/seller/products/new")}
              className="flex-row items-center gap-2 rounded-full bg-brand-600 px-4 py-2"
            >
              <Text className="text-[12px] font-semibold text-white">
                {t("products.addInApp")}
              </Text>
            </Pressable>
          </View>
        </View>

        {shopQuery.isLoading ? (
          <View className="py-16">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : products.length === 0 ? (
          <View className="mx-5 mt-8 items-center rounded-2xl border border-dashed border-border p-10">
            <Text className="text-[28px]">📦</Text>
            <Text className="mt-2 text-[13px] text-fg">{t("products.empty")}</Text>
            <Text className="mt-1 text-center text-[11px] text-muted">
              {t("products.emptyHint")}
            </Text>
          </View>
        ) : (
          <View className="mt-4 px-4">
            <View className="flex-row flex-wrap">
              {products.map((p) => (
                <Pressable
                  key={p.slug}
                  onPress={() =>
                    router.push(
                      `/seller/products/${p.slug}/edit` as never,
                    )
                  }
                  className="m-1 w-[48%] overflow-hidden rounded-2xl border border-border bg-white"
                >
                  <View className="aspect-square w-full bg-brand-50">
                    {p.imageUrls?.[0] ? (
                      <Image
                        source={{ uri: p.imageUrls[0] }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <View className="size-full items-center justify-center">
                        <Text className="text-[28px]">🛍</Text>
                      </View>
                    )}
                  </View>
                  <View className="p-3">
                    <Text
                      className="text-[13px] font-medium text-fg"
                      numberOfLines={2}
                    >
                      {p.name}
                    </Text>
                    <Text className="mt-1 text-[15px] font-bold text-brand-700">
                      {formatBaht(p.priceSatang)}
                    </Text>
                    {typeof p.stock === "number" ? (
                      <Text
                        className={`mt-0.5 text-[10px] ${
                          p.stock === 0
                            ? "text-rose-600"
                            : p.stock < 5
                              ? "text-amber-700"
                              : "text-muted"
                        }`}
                      >
                        {p.stock === 0
                          ? t("shop:outOfStock")
                          : t("shop:lowStock", { count: p.stock })}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
