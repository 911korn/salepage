import { useLocalSearchParams, router, Link } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Image } from "expo-image";
import { memo, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { safeBack } from "@/lib/safe-back";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { BrandBackButton } from "@/components/ui/back-button";
import { ReportSheet } from "@/components/report-sheet";
import { VerifiedBadge, TrustMeter, RiskWarning } from "@/components/trust-badge";
import { ReviewsList } from "@/components/reviews-list";
import { GroupBuyRail } from "@/components/group-buy-rail";
import { ShopCover } from "@/components/shop-cover";
import { Share2, Heart, Plus, Check, Flag } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { i18n } from "@/lib/i18n";
import { api, ApiClientError } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { formatBaht } from "@/lib/format";
import { shareShop } from "@/lib/share";
import type { ShopSummary } from "@/types/api";

/**
 * Floating back button — overlays the top-left of the shop cover so the
 * banner can bleed all the way to the status bar. Mirrors the product
 * detail screen's pattern (911korn 2026-05-27 02:58 screenshot flagged
 * the residual white band from the old `headerTransparent: true` setup).
 */
function ShopBackFloatingButton() {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        zIndex: 10,
      }}
    >
      <BrandBackButton tone="light" />
    </View>
  );
}

export default function ShopScreen() {
  const { t } = useTranslation(["shop", "common"]);
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [reportOpen, setReportOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => api.shop.get(slug!),
    enabled: Boolean(slug),
  });

  if (isLoading) {
    return (
      <Screen>
        <ShopBackFloatingButton />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ShopBackFloatingButton />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-fg">
            {t("shopNotFound")} <Text className="font-semibold">{slug}</Text>
          </Text>
          <Button className="mt-4" variant="outline" onPress={() => safeBack()}>
            {t("common:actions.back")}
          </Button>
        </View>
      </Screen>
    );
  }

  const { shop, products } = data;

  return (
    <Screen scroll>
      <ShopBackFloatingButton />
      {/* Banner — buyer's first impression. Falls back to a branded
          gradient with soft blobs if the owner hasn't uploaded a cover. */}
      <ShopCover
        bannerUrl={shop.bannerUrls[0]}
        themeColor={shop.themeColor}
        height={176}
        showWordmark={false}
      />

      {/* Shop card */}
      <View className="-mt-12 mx-5 rounded-3xl border border-border bg-white p-5 shadow-sm">
        <View className="flex-row items-end gap-3">
          <View
            className="size-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white"
            style={{ backgroundColor: shop.themeColor }}
          >
            {shop.logoUrl ? (
              <Image
                source={{ uri: shop.logoUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <Text className="text-2xl font-bold text-white">
                {shop.logoText ?? shop.name.slice(0, 1)}
              </Text>
            )}
          </View>
          <View className="flex-1 pb-1">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-xl font-bold text-fg">{shop.name}</Text>
              <VerifiedBadge kycStatus={shop.kycStatus} />
            </View>
            {shop.category ? (
              <Text className="mt-0.5 text-[13px] text-muted">{shop.category}</Text>
            ) : null}
          </View>
          <View className="flex-row gap-1.5">
            <Pressable
              onPress={() => shareShop(shop.slug, shop.name)}
              className="size-9 items-center justify-center rounded-full border border-border bg-white"
              accessibilityLabel={t("share")}
            >
              <Share2 size={16} color="#0a0a0a" strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={() => setReportOpen(true)}
              className="size-9 items-center justify-center rounded-full border border-border bg-white"
              accessibilityLabel="รายงานร้านนี้"
            >
              <Flag size={15} color="#737373" strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {/* Follow + follower count */}
        <FollowRow shop={shop} />

        {shop.description ? (
          <Text className="mt-4 text-[14px] leading-relaxed text-fg">
            {shop.description}
          </Text>
        ) : null}

        {shop.announcement ? (
          <View className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 px-3 py-2.5">
            <Text className="text-[13px] text-brand-800">{shop.announcement}</Text>
          </View>
        ) : null}

        <View className="mt-4 flex-row gap-2">
          <StatPill label={t("statProducts")} value={String(products.length)} />
          <StatPill label={t("statRating")} value={shop.rating > 0 ? shop.rating.toFixed(1) : "—"} />
          <StatPill label={t("statSold")} value={shop.totalSold > 0 ? `${shop.totalSold}+` : "—"} />
        </View>

        {/* Trust meter — always shown so buyers can compare across shops */}
        <View className="mt-3">
          <TrustMeter score={shop.trustScore} />
        </View>

        {/* Risk banner for very-new + unverified shops only */}
        {shop.kycStatus !== "VERIFIED" && shop.trustScore < 50 ? (
          <View className="mt-3">
            <RiskWarning message={t("riskNotice")} />
          </View>
        ) : null}

        {/* Public dispute stats — only when there's at least one real dispute */}
        {shop.disputeStats && shop.disputeStats.count > 0 ? (
          <View className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <Text className="text-[12px] font-semibold text-amber-900">
              {t("disputeStatsHeadline")}
            </Text>
            <Text className="mt-0.5 text-[11px] text-amber-800">
              {t("disputeStatsBody", {
                count: shop.disputeStats.count,
                delivered: shop.disputeStats.deliveredCount,
                rate: shop.disputeStats.ratePct,
              })}
            </Text>
          </View>
        ) : null}

        {/* V1.5 Protected Pay shield — hidden 2026-05-28 along with the
            cart toggle (911korn "ฝาก hide feture นี้ไว้ก่อน"). Will return
            when user volume scales enough to justify the +1.5% escrow fee.
            {shop.acceptsEscrow ? (
              <View className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <Text className="text-[12px] font-semibold text-emerald-900">
                  {t("protectedPayHeadline")}
                </Text>
                <Text className="mt-0.5 text-[11px] text-emerald-800">
                  {t("protectedPayBody")}
                </Text>
              </View>
            ) : null}
        */}
      </View>

      {/* V2.0 Group Buy rail — self-hides when the shop has no active campaign. */}
      <GroupBuyRail shopSlug={slug!} />

      {/* Products grid */}
      <View className="mx-5 mt-6">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-lg font-bold text-fg">{t("products")}</Text>
          <Text className="text-[12px] text-muted">{t("productCount", { count: products.length })}</Text>
        </View>
        <View className="mt-3 flex-row flex-wrap -mx-1">
          {products.map((p) => (
            <ProductCard key={p.slug} shopSlug={shop.slug} product={p} />
          ))}
          {products.length === 0 ? (
            <View className="m-1 w-full rounded-2xl border border-dashed border-border bg-white p-8">
              <Text className="text-center text-[14px] text-muted">
                {t("noProducts")}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Reviews */}
      <View className="mx-5 mt-6">
        <ReviewsList slug={shop.slug} limit={6} />
      </View>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        kind="SHOP"
        targetId={shop.slug}
        targetLabel={shop.name}
      />
    </Screen>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-xl border border-border bg-soft px-3 py-2">
      <Text className="text-[10px] uppercase tracking-wider text-muted">{label}</Text>
      <Text className="mt-0.5 text-base font-bold text-fg">{value}</Text>
    </View>
  );
}

const ProductCard = memo(function ProductCard({
  shopSlug,
  product,
}: {
  shopSlug: string;
  product: {
    slug: string;
    name: string;
    priceSatang: number;
    compareAtSatang: number | null;
    imageUrls: string[];
    badge: string | null;
    sold: number;
  };
}) {
  const discount = useMemo(() => {
    if (!product.compareAtSatang || product.compareAtSatang <= product.priceSatang) {
      return null;
    }
    return Math.round(
      ((product.compareAtSatang - product.priceSatang) / product.compareAtSatang) * 100,
    );
  }, [product]);

  return (
    <Link href={`/s/${shopSlug}/${product.slug}`} asChild>
      <Pressable className="m-1 w-[48%] overflow-hidden rounded-2xl border border-border bg-white">
        <View className="aspect-square w-full bg-brand-50">
          {product.imageUrls[0] ? (
            <Image
              source={{ uri: product.imageUrls[0] }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
              recyclingKey={`${shopSlug}-${product.slug}`}
            />
          ) : null}
          {discount ? (
            <View className="absolute left-2 top-2 rounded-md bg-black/80 px-1.5 py-0.5">
              <Text className="text-[10px] font-bold text-white">-{discount}%</Text>
            </View>
          ) : null}
          {product.badge ? (
            <View className="absolute right-2 top-2 rounded-md bg-brand-600 px-1.5 py-0.5">
              <Text className="text-[10px] font-bold uppercase text-white">
                {product.badge}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="p-3">
          <Text className="text-[13px] font-medium text-fg" numberOfLines={2}>
            {product.name}
          </Text>
          <View className="mt-2 flex-row items-baseline gap-1">
            <Text className="text-[15px] font-bold text-brand-700">
              {formatBaht(product.priceSatang)}
            </Text>
            {product.compareAtSatang && product.compareAtSatang > product.priceSatang ? (
              <Text className="text-[10px] text-muted line-through">
                {formatBaht(product.compareAtSatang)}
              </Text>
            ) : null}
          </View>
          <Text className="mt-1 text-[10px] text-muted">
            {i18n.t("shop:soldCount", { count: product.sold.toLocaleString() })}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
});

// Silence unused-import lint for ScrollView (left here for future filters tab).
void ScrollView;

/**
 * Follow row — shows follower count + Follow/Following toggle button.
 * Optimistic update: flips the button state immediately, rolls back if
 * the network call fails. Anonymous viewers get bounced to /signin with
 * `redirect` pointing back here so they land on the shop after auth.
 */
function FollowRow({ shop }: { shop: ShopSummary }) {
  const { t } = useTranslation("shop");
  const qc = useQueryClient();
  const following = shop.isFollowing ?? false;
  const followerCount = shop.followerCount ?? 0;

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) await api.shops.follow(shop.slug);
      else await api.shops.unfollow(shop.slug);
      return next;
    },
    onMutate: async (next) => {
      // Optimistic: patch the cached shop GET so the button + count flip
      // immediately. The shop GET key matches the parent useQuery.
      await qc.cancelQueries({ queryKey: ["shop", shop.slug] });
      const prev = qc.getQueryData<{ shop: ShopSummary }>(["shop", shop.slug]);
      qc.setQueryData(["shop", shop.slug], (old: { shop: ShopSummary } | undefined) =>
        old
          ? {
              ...old,
              shop: {
                ...old.shop,
                isFollowing: next,
                followerCount: Math.max(
                  0,
                  (old.shop.followerCount ?? 0) + (next ? 1 : -1),
                ),
              },
            }
          : old,
      );
      return { prev };
    },
    onError: (err, _next, ctx) => {
      // Roll back and surface the error
      if (ctx?.prev) qc.setQueryData(["shop", shop.slug], ctx.prev);
      const msg = err instanceof ApiClientError ? err.message : "ลองใหม่อีกครั้ง";
      Alert.alert(t("followError", { defaultValue: "ติดตามไม่สำเร็จ" }), msg);
    },
  });

  async function onPress() {
    const token = await getAuthToken();
    if (!token) {
      // Anonymous viewer → send to signin then back here
      router.push(`/signin?redirect=/s/${shop.slug}`);
      return;
    }
    mutation.mutate(!following);
  }

  return (
    <View className="mt-3 flex-row items-center gap-3">
      <Pressable
        onPress={onPress}
        disabled={mutation.isPending}
        className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 ${
          following
            ? "border border-border bg-soft active:bg-border/40"
            : "bg-brand-600 active:bg-brand-700"
        } ${mutation.isPending ? "opacity-70" : ""}`}
      >
        {following ? (
          <Check size={16} color="#0a0a0a" strokeWidth={2.4} />
        ) : (
          <Plus size={16} color="#ffffff" strokeWidth={2.4} />
        )}
        <Text
          className={`text-[14px] font-semibold ${following ? "text-fg" : "text-white"}`}
        >
          {following ? t("following", { defaultValue: "กำลังติดตาม" }) : t("follow", { defaultValue: "ติดตาม" })}
        </Text>
      </Pressable>

      <View className="flex-row items-center gap-1.5">
        <Heart size={14} color="#737373" strokeWidth={2} />
        <Text className="text-[13px] text-muted">
          {t("followers", {
            count: followerCount,
            defaultValue: `${followerCount.toLocaleString()} ผู้ติดตาม`,
          })}
        </Text>
      </View>
    </View>
  );
}
