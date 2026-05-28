import { memo, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
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

  const renderItem: ListRenderItem<(typeof products)[number]> = useCallback(
    ({ item }) => <ProductCard product={item} />,
    [],
  );

  const Header = (
    <View className="px-5 pt-2 pb-3">
      <Text className="text-[20px] font-bold text-fg">
        {t("products.header", { name: shopQuery.data?.shop.name ?? "" })}
      </Text>
      <View className="mt-1 flex-row items-center gap-2">
        <Text className="text-[12px] text-muted">
          {t("products.subtitle", { count: products.length })}
        </Text>
        <Pressable
          onPress={() => router.push("/seller/products/new")}
          className="ml-auto flex-row items-center gap-1 rounded-full bg-brand-600 px-3 py-1.5"
        >
          <Text className="text-[12px] font-semibold text-white">
            {t("products.addInApp")}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen>
      {/* FlashList — Shopify's recycler-based replacement for FlatList.
          Recycles view instances on scroll so the 60fps scroll holds
          even at 100+ products (911korn 2026-05-27 "ลื่นหัวแตก"). */}
      <FlashList
        data={products}
        numColumns={2}
        keyExtractor={(p) => p.slug}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          shopQuery.isLoading ? (
            <View className="py-16">
              <ActivityIndicator color="#e11d48" />
            </View>
          ) : (
            <View className="mx-5 mt-8 items-center rounded-2xl border border-dashed border-border p-10">
              <Text className="text-[28px]">📦</Text>
              <Text className="mt-2 text-[13px] text-fg">
                {t("products.empty")}
              </Text>
              <Text className="mt-1 text-center text-[11px] text-muted">
                {t("products.emptyHint")}
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 64, paddingHorizontal: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={shopQuery.isFetching}
            onRefresh={() => void shopQuery.refetch()}
            tintColor="#e11d48"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

type ProductRow = NonNullable<
  Awaited<ReturnType<typeof api.shop.get>>["products"]
>[number];

const ProductCard = memo(function ProductCard({
  product,
}: {
  product: ProductRow;
}) {
  const { t } = useTranslation(["seller", "shop"]);
  const slug = useSellerMode((s) => s.activeShopSlug);

  return (
    <Pressable
      onPress={() =>
        router.push(`/seller/products/${product.slug}/edit` as never)
      }
      style={{ marginHorizontal: 4, marginBottom: 8 }}
      className="overflow-hidden rounded-2xl border border-border bg-white"
    >
      <View className="aspect-square w-full bg-brand-50">
        {product.imageUrls?.[0] ? (
          <Image
            source={{ uri: product.imageUrls[0] }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={`${product.id}-${product.imageUrls.length}`}
          />
        ) : (
          // Empty-state placeholder — branded card showing the product
          // name initial + "ใส่รูป" CTA so the seller is nudged to fix
          // it instead of seeing an inscrutable shopping-bag emoji.
          // 911korn 2026-05-28 "ในแอพภาพที่เสียค้างเต็มเลย".
          <View className="size-full items-center justify-center px-3">
            <View className="size-12 items-center justify-center rounded-2xl bg-white">
              <Text className="text-[20px] font-bold text-brand-700">
                {(product.name || "?").slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text
              className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-rose-600"
            >
              ⚠ ใส่รูปสินค้า
            </Text>
          </View>
        )}
      </View>
      <View className="p-3">
        <Text
          className="text-[13px] font-medium text-fg"
          numberOfLines={2}
        >
          {product.name}
        </Text>
        <Text className="mt-1 text-[15px] font-bold text-brand-700">
          {formatBaht(product.priceSatang)}
        </Text>
        {typeof product.stock === "number" ? (
          <Text
            className={`mt-0.5 text-[10px] ${
              product.stock === 0
                ? "text-rose-600"
                : product.stock < 5
                  ? "text-amber-700"
                  : "text-muted"
            }`}
          >
            {product.stock === 0
              ? t("shop:outOfStock")
              : t("shop:lowStock", { count: product.stock })}
          </Text>
        ) : null}
      </View>
      {/* Silence unused-var warning — `slug` reserved for navigating to a
          live preview route in a follow-up. */}
      {slug ? null : null}
    </Pressable>
  );
});
