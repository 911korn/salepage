import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { api } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { shareProduct } from "@/lib/share";
import { useCart } from "@/store/cart";

export default function ProductScreen() {
  const { t } = useTranslation(["shop", "common"]);
  const { slug, productSlug } = useLocalSearchParams<{
    slug: string;
    productSlug: string;
  }>();
  const { data, isLoading } = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => api.shop.get(slug!),
    enabled: Boolean(slug),
  });

  const product = useMemo(
    () => data?.products.find((p) => p.slug === productSlug),
    [data, productSlug],
  );
  const addToCart = useCart((s) => s.add);

  if (isLoading || !data) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }
  if (!product) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-fg">{t("productNotFound")}</Text>
          <Button className="mt-4" variant="outline" onPress={() => router.back()}>
            {t("common:actions.back")}
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        {/* Hero gallery — swipe + tap-to-zoom */}
        <ProductImageGallery images={product.imageUrls} />

        <View className="px-5 pt-5">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-[22px] font-bold text-fg">
              {product.name}
            </Text>
            <Pressable
              onPress={() =>
                shareProduct({
                  shopSlug: data.shop.slug,
                  productSlug: product.slug,
                  productName: product.name,
                  priceBaht: Math.round(product.priceSatang / 100),
                })
              }
              className="size-9 items-center justify-center rounded-full border border-border bg-white"
              accessibilityLabel={t("share")}
            >
              <Text className="text-[16px]">↑</Text>
            </Pressable>
          </View>

          <View className="mt-3 flex-row items-baseline gap-2">
            <Text className="text-[26px] font-bold text-brand-700">
              {formatBaht(product.priceSatang)}
            </Text>
            {product.compareAtSatang &&
            product.compareAtSatang > product.priceSatang ? (
              <Text className="text-[14px] text-muted line-through">
                {formatBaht(product.compareAtSatang)}
              </Text>
            ) : null}
          </View>

          <View className="mt-3 flex-row items-center gap-2">
            <View className="rounded-full border border-border bg-white px-2.5 py-0.5">
              <Text className="text-[11px] text-fg">
                {product.type === "DIGITAL" ? t("digital") : t("physical")}
              </Text>
            </View>
            <Text className="text-[12px] text-muted">
              {t("soldCount", { count: product.sold.toLocaleString() })}
            </Text>
          </View>

          {product.description ? (
            <View className="mt-5 rounded-2xl border border-border bg-white p-4">
              <Text className="text-[13px] font-semibold uppercase tracking-wider text-muted">
                {t("description")}
              </Text>
              <Text className="mt-2 text-[14px] leading-relaxed text-fg">
                {product.description}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky Add-to-Cart bar */}
      <View className="absolute bottom-0 left-0 right-0 flex-row items-center gap-2 border-t border-border bg-white px-4 py-3 pb-6">
        <Button
          variant="outline"
          className="flex-1"
          onPress={() => {
            addToCart(data.shop.slug, data.shop.name, {
              productSlug: product.slug,
              productName: product.name,
              priceSatang: product.priceSatang,
              imageUrl: product.imageUrls[0] ?? null,
              qty: 1,
            });
          }}
        >
          {t("addToCart")}
        </Button>
        <Button
          className="flex-1"
          onPress={() => {
            addToCart(data.shop.slug, data.shop.name, {
              productSlug: product.slug,
              productName: product.name,
              priceSatang: product.priceSatang,
              imageUrl: product.imageUrls[0] ?? null,
              qty: 1,
            });
            router.push("/cart");
          }}
        >
          {t("buyNow")}
        </Button>
      </View>
    </Screen>
  );
}
