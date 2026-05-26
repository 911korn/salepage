import { useLocalSearchParams, router, Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useMemo } from "react";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { VerifiedBadge, TrustMeter, RiskWarning } from "@/components/trust-badge";
import { ReviewsList } from "@/components/reviews-list";
import { GroupBuyRail } from "@/components/group-buy-rail";
import { ShopCover } from "@/components/shop-cover";
import { api } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { shareShop } from "@/lib/share";
import { useCart, selectItemCount } from "@/store/cart";

export default function ShopScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => api.shop.get(slug!),
    enabled: Boolean(slug),
  });
  const cartCount = useCart(selectItemCount);

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-fg">
            ไม่พบร้าน <Text className="font-semibold">{slug}</Text>
          </Text>
          <Button className="mt-4" variant="outline" onPress={() => router.back()}>
            ย้อนกลับ
          </Button>
        </View>
      </Screen>
    );
  }

  const { shop, products } = data;

  return (
    <Screen scroll>
      {/* Banner — buyer's first impression. Falls back to a branded
          gradient + shop initial if the owner hasn't uploaded a cover. */}
      <ShopCover
        bannerUrl={shop.bannerUrls[0]}
        themeColor={shop.themeColor}
        logoText={shop.logoText}
        shopName={shop.name}
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
          <Pressable
            onPress={() => shareShop(shop.slug, shop.name)}
            className="size-9 items-center justify-center rounded-full border border-border bg-white"
            accessibilityLabel="แชร์ร้าน"
          >
            <Text className="text-[16px]">↑</Text>
          </Pressable>
        </View>

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
          <StatPill label="สินค้า" value={String(products.length)} />
          <StatPill label="คะแนน" value={shop.rating > 0 ? shop.rating.toFixed(1) : "—"} />
          <StatPill label="ยอดขาย" value={shop.totalSold > 0 ? `${shop.totalSold}+` : "—"} />
        </View>

        {/* Trust meter — always shown so buyers can compare across shops */}
        <View className="mt-3">
          <TrustMeter score={shop.trustScore} />
        </View>

        {/* Risk banner for very-new + unverified shops only */}
        {shop.kycStatus !== "VERIFIED" && shop.trustScore < 50 ? (
          <View className="mt-3">
            <RiskWarning message="ร้านนี้ยังไม่ได้ยืนยันตัวตน (KYC) แนะนำให้สั่งยอดไม่สูง และตรวจสอบผู้ขายก่อนโอนเงิน" />
          </View>
        ) : null}

        {/* Public dispute stats — only when there's at least one real dispute */}
        {shop.disputeStats && shop.disputeStats.count > 0 ? (
          <View className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <Text className="text-[12px] font-semibold text-amber-900">
              ⚠️ ข้อพิพาทล่าสุด (90 วัน)
            </Text>
            <Text className="mt-0.5 text-[11px] text-amber-800">
              {shop.disputeStats.count} ออเดอร์จากทั้งหมด {shop.disputeStats.deliveredCount} —{" "}
              {shop.disputeStats.ratePct}% ของยอดขายถูกร้องเรียน
            </Text>
          </View>
        ) : null}

        {/* V1.5 Protected Pay shield — shown when the shop opted in. Tells
            buyers they can pay through escrow at checkout (+1.5% fee). */}
        {shop.acceptsEscrow ? (
          <View className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <Text className="text-[12px] font-semibold text-emerald-900">
              🛡️ Protected Pay พร้อมใช้
            </Text>
            <Text className="mt-0.5 text-[11px] text-emerald-800">
              เลือก &quot;Protected Pay&quot; ตอน checkout (+1.5%) —
              เงินถูกกักจนคุณยืนยันได้รับสินค้า
            </Text>
          </View>
        ) : null}
      </View>

      {/* V2.0 Group Buy rail — self-hides when the shop has no active campaign. */}
      <GroupBuyRail shopSlug={slug!} />

      {/* Products grid */}
      <View className="mx-5 mt-6">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-lg font-bold text-fg">สินค้าทั้งหมด</Text>
          <Text className="text-[12px] text-muted">{products.length} รายการ</Text>
        </View>
        <View className="mt-3 flex-row flex-wrap -mx-1">
          {products.map((p) => (
            <ProductCard key={p.slug} shopSlug={shop.slug} product={p} />
          ))}
          {products.length === 0 ? (
            <View className="m-1 w-full rounded-2xl border border-dashed border-border bg-white p-8">
              <Text className="text-center text-[14px] text-muted">
                ยังไม่มีสินค้าในร้านนี้
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Reviews */}
      <View className="mx-5 mt-6">
        <ReviewsList slug={shop.slug} limit={6} />
      </View>

      {/* Floating cart */}
      {cartCount > 0 ? (
        <Pressable
          onPress={() => router.push("/cart")}
          className="absolute bottom-8 right-5 flex-row items-center gap-2 rounded-full bg-brand-600 px-5 py-3 shadow-lg"
        >
          <Text className="font-semibold text-white">ตะกร้า ({cartCount})</Text>
        </Pressable>
      ) : null}
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

function ProductCard({
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
            ขายแล้ว {product.sold.toLocaleString()}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

// Silence unused-import lint for ScrollView (left here for future filters tab).
void ScrollView;
