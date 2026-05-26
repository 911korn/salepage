import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { View, Text, ScrollView, ActivityIndicator, Pressable, Dimensions } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, ShoppingBag } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  runOnJS,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { api } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { shareProduct } from "@/lib/share";
import { useCart, selectItemCount } from "@/store/cart";

const SCREEN_W = Dimensions.get("window").width;

/**
 * Floating close button — overlays the top-left of the product modal
 * so the hero image bleeds all the way to the status bar (911korn
 * 2026-05-27 IMG_5239 "ใช้เป็น Modal ... มีแค่ X ซ้ายบนให้กดปิด หรือ
 * ปัดลง"). Translucent dark pill survives any product photo colour.
 */
function ProductCloseButton() {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Close"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(15,15,15,0.5)",
      }}
    >
      <X size={20} color="#ffffff" strokeWidth={2.4} />
    </Pressable>
  );
}

/**
 * Floating cart shortcut — mirrors the close button on the right. Receives
 * a `scale` SharedValue from the parent so the parent's add-to-cart
 * handler can punch a bounce when the flying ghost lands here. Badge
 * shows the live cart item count (911korn 2026-05-27: "อนิเมชั่นของไหลไป
 * ตระกร้า").
 */
function ProductCartButton({ scale }: { scale: SharedValue<number> }) {
  const insets = useSafeAreaInsets();
  const itemCount = useCart(selectItemCount);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: insets.top + 8,
          right: 16,
          zIndex: 10,
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={() => router.push("/cart")}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="View cart"
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(15,15,15,0.5)",
        }}
      >
        <ShoppingBag size={18} color="#ffffff" strokeWidth={2.4} />
        {itemCount > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 4,
              borderRadius: 9,
              backgroundColor: "#e11d48",
              borderWidth: 2,
              borderColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "700" }}>
              {itemCount > 99 ? "99+" : itemCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Flying ghost — short-lived absolutely-positioned image that arcs from
 * the bottom-center "Add to cart" button up to the top-right cart pill.
 * Spawned by `flyToCart` on tap; calls `onArrived` so the parent can
 * bounce the cart icon + unmount the ghost.
 */
function FlyingProduct({
  uri,
  startY,
  onArrived,
}: {
  uri: string;
  startY: number;
  onArrived: () => void;
}) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  // Cart center: matches ProductCartButton's transform anchor (right: 16,
  // width 36 → center at SCREEN_W - 16 - 18). Vertical: insets.top + 8 + 18.
  const targetX = SCREEN_W - 16 - 18;
  const targetY = insets.top + 8 + 18;
  // Start centered horizontally on the screen, vertically at the button.
  // The arc lifts the ghost up + over (cubic ease-in gives the gravity feel).
  const startX = SCREEN_W / 2 - 30;
  const arcStartX = startX;
  const arcStartY = startY - 30;

  // Kick off the flight on mount. One-frame flash at progress=0 is
  // imperceptible at 60fps and avoids the "side effect in useMemo"
  // antipattern.
  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: 650, easing: Easing.in(Easing.cubic) },
      (done) => {
        if (done) runOnJS(onArrived)();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const x = arcStartX + (targetX - arcStartX) * p - 30 * (1 - p);
    const y = arcStartY + (targetY - arcStartY) * p;
    const size = 60 - 44 * p; // 60 → 16
    return {
      position: "absolute",
      left: x,
      top: y,
      width: size,
      height: size,
      borderRadius: size / 2,
      opacity: 1 - 0.2 * p,
      transform: [{ rotate: `${360 * p}deg` }],
      zIndex: 100,
      overflow: "hidden",
      // soft glow so it pops over white backgrounds too
      shadowColor: "#0a0a0a",
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    };
  });

  return (
    <Animated.View style={style} pointerEvents="none">
      <Image
        source={{ uri }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
      />
    </Animated.View>
  );
}

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

  // Cart-icon bounce + flying ghost state, lifted here so both the
  // "Add to cart" + "Buy now" buttons share a single in-flight animation.
  const cartScale = useSharedValue(1);
  const [flying, setFlying] = useState<{ uri: string; startY: number; id: number } | null>(null);

  const bounceCart = useCallback(() => {
    cartScale.value = withSequence(
      withTiming(1.35, { duration: 140, easing: Easing.out(Easing.back(2)) }),
      withSpring(1, { damping: 7, stiffness: 220 }),
    );
  }, [cartScale]);

  const handleAddToCart = useCallback(
    (opts: { navigate: boolean }) => {
      if (!data || !product) return;
      addToCart(data.shop.slug, data.shop.name, {
        productSlug: product.slug,
        productName: product.name,
        priceSatang: product.priceSatang,
        imageUrl: product.imageUrls[0] ?? null,
        qty: 1,
      });
      // Buy now jumps to /cart immediately — no time for a flight. The
      // bottom-Add button gets the full delight pattern.
      if (opts.navigate) {
        router.push("/cart");
        return;
      }
      const uri = product.imageUrls[0];
      if (!uri) {
        // No image to fly — still bounce the cart so the buyer gets
        // SOME confirmation feedback.
        bounceCart();
        return;
      }
      setFlying({ uri, startY: 0, id: Date.now() });
    },
    [addToCart, bounceCart, data, product],
  );

  if (isLoading || !data) {
    return (
      <Screen>
        <ProductCloseButton />
        <ProductCartButton scale={cartScale} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }
  if (!product) {
    return (
      <Screen>
        <ProductCloseButton />
        <ProductCartButton scale={cartScale} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-fg">{t("productNotFound")}</Text>
          <Button className="mt-4" variant="outline" onPress={() => router.back()}>
            {t("common:actions.back")}
          </Button>
        </View>
      </Screen>
    );
  }

  // Approximate Y where the "Add to cart" button sits — the ghost spawns
  // there and arcs up to the cart pill. Using window height keeps it close
  // enough on iPhone X+ devices without measuring layout.
  const ghostStartY = Dimensions.get("window").height - 96;

  return (
    <Screen>
      <ProductCloseButton />
      <ProductCartButton scale={cartScale} />
      <ScrollView contentContainerClassName="pb-32">
        {/* Hero gallery — swipe + tap-to-zoom. Bleeds to the status bar
            since this screen renders as a fullScreenModal with no header. */}
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
          onPress={() => handleAddToCart({ navigate: false })}
        >
          {t("addToCart")}
        </Button>
        <Button
          className="flex-1"
          onPress={() => handleAddToCart({ navigate: true })}
        >
          {t("buyNow")}
        </Button>
      </View>

      {/* Flying ghost — rendered last so it sits on top of everything,
          including the sticky bottom bar. Keyed by `id` so retapping
          before the previous flight finishes restarts the animation
          cleanly instead of throttling. */}
      {flying ? (
        <FlyingProduct
          key={flying.id}
          uri={flying.uri}
          startY={ghostStartY}
          onArrived={() => {
            bounceCart();
            setFlying(null);
          }}
        />
      ) : null}
    </Screen>
  );
}
