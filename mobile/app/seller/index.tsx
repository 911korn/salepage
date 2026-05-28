import { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { VerifiedBadge, TrustMeter } from "@/components/trust-badge";
import { api } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { useSellerMode } from "@/store/seller-mode";
import { useTranslation } from "react-i18next";
import {
  Package,
  Package2,
  ShoppingBag,
  // Stories/Live/Group Buy icons kept in case we un-hide before TestFlight 2.
  // Camera, Radio, Users,
  MessageSquare,
  Globe,
  Palette,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react-native";

/**
 * /seller — Seller dashboard home.
 *
 * Top: shop picker (if owner has multiple shops).
 * Middle: quick stats (pending slips, today/7d/30d sales, unread chat).
 * Bottom: action grid (orders / products / chat / settings).
 *
 * Pull-to-refresh refetches both the shop list AND the active stats — saves
 * the seller from switching tabs to see fresh numbers.
 */
export default function SellerHomeScreen() {
  const { t } = useTranslation("seller");
  const activeSlug = useSellerMode((s) => s.activeShopSlug);
  const setActiveShop = useSellerMode((s) => s.setActiveShop);
  const setMode = useSellerMode((s) => s.setMode);

  const shopsQuery = useQuery({
    queryKey: ["me", "shops"],
    queryFn: () => api.me.shops(),
  });

  // Auto-pick the first shop if none active. Lets a single-shop owner skip
  // the picker entirely.
  useEffect(() => {
    if (!activeSlug && shopsQuery.data?.shops?.[0]) {
      setActiveShop(shopsQuery.data.shops[0].slug);
    }
  }, [activeSlug, shopsQuery.data, setActiveShop]);

  const statsQuery = useQuery({
    queryKey: ["seller", "stats", activeSlug],
    queryFn: () => api.shops.stats(activeSlug!),
    enabled: Boolean(activeSlug),
    refetchInterval: 30_000, // background poll so pending count stays fresh
  });

  const activeShop = shopsQuery.data?.shops.find((s) => s.slug === activeSlug);

  if (shopsQuery.isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  if (!shopsQuery.data || shopsQuery.data.shops.length === 0) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-[16px] font-semibold text-fg">
            {t("noShopHeadline")}
          </Text>
          <Text className="mt-2 text-center text-[12px] text-muted">
            {t("noShopBody")}
          </Text>
          <Button
            variant="outline"
            className="mt-6"
            onPress={() => {
              // Nuke the seller stack so we don't carry edit-product
              // screens / dashboards under the next buyer-mode screen
              // (911korn 2026-05-28 01:35 "Edit Product กดออกมา Buyer
              // mode มาหน้าสินค้าแล้วค้างกดอะไรไม่ได้"). dismissAll
              // pops every modal we may have opened; router.replace then
              // mounts /me fresh.
              try {
                if (router.canDismiss()) router.dismissAll();
              } catch {
                /* older expo-router — ignore */
              }
              setMode("buyer");
              router.replace("/me");
            }}
          >
            {t("backToBuyer")}
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-32"
        refreshControl={
          <RefreshControl
            refreshing={statsQuery.isFetching}
            onRefresh={() => {
              void shopsQuery.refetch();
              void statsQuery.refetch();
            }}
            tintColor="#e11d48"
          />
        }
      >
        {/* Mode toggle banner */}
        <View className="mx-5 mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                {t("sellerModeLabel")}
              </Text>
              <Text className="mt-0.5 text-[12px] text-amber-900">
                {t("sellerModeSub")}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                try {
                  if (router.canDismiss()) router.dismissAll();
                } catch {
                  /* older expo-router — ignore */
                }
                setMode("buyer");
                router.replace("/me");
              }}
              className="rounded-full border border-amber-300 bg-white px-3 py-1.5"
            >
              <Text className="text-[11px] font-semibold text-amber-700">
                {t("switchToBuyer")}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Shop picker — only if 2+ shops */}
        {shopsQuery.data.shops.length > 1 ? (
          <View className="mt-4 px-5">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {t("pickShop")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 py-2"
            >
              {shopsQuery.data.shops.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setActiveShop(s.slug)}
                  className={`flex-row items-center gap-2 rounded-full border px-3 py-2 ${
                    s.slug === activeSlug
                      ? "border-brand-300 bg-brand-50"
                      : "border-border bg-white"
                  }`}
                >
                  <View
                    className="size-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: s.themeColor }}
                  >
                    <Text className="text-[10px] font-bold text-white">
                      {s.logoText ?? s.name.slice(0, 1)}
                    </Text>
                  </View>
                  <Text
                    className={`text-[12px] font-medium ${
                      s.slug === activeSlug ? "text-brand-700" : "text-fg"
                    }`}
                    numberOfLines={1}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Active shop card */}
        {activeShop ? (
          <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
            <View className="flex-row items-center gap-3">
              <View
                className="size-14 items-center justify-center overflow-hidden rounded-2xl"
                style={{ backgroundColor: activeShop.themeColor }}
              >
                {activeShop.logoUrl ? (
                  <Image
                    source={{ uri: activeShop.logoUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : (
                  <Text className="text-[20px] font-bold text-white">
                    {activeShop.logoText ?? activeShop.name.slice(0, 1)}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text
                    className="text-[16px] font-semibold text-fg"
                    numberOfLines={1}
                  >
                    {activeShop.name}
                  </Text>
                  <VerifiedBadge kycStatus={activeShop.kycStatus} compact />
                </View>
                <Text className="mt-0.5 text-[11px] text-muted">
                  @{activeShop.slug}
                </Text>
              </View>
            </View>
            <View className="mt-3">
              <TrustMeter score={activeShop.trustScore} />
            </View>
          </View>
        ) : null}

        {/* Stats grid */}
        {statsQuery.data ? (
          <View className="mx-5 mt-4 gap-2">
            <View className="flex-row gap-2">
              <StatCard
                label={t("home.stats.pending")}
                value={String(statsQuery.data.pendingOrderCount)}
                tone={
                  statsQuery.data.pendingOrderCount > 0 ? "urgent" : "default"
                }
                onPress={() =>
                  router.push(`/seller/orders?status=PENDING`)
                }
              />
              <StatCard
                label={t("home.stats.paid")}
                value={String(statsQuery.data.paidOrderCount)}
                tone={
                  statsQuery.data.paidOrderCount > 0 ? "warn" : "default"
                }
                onPress={() => router.push(`/seller/orders?status=PAID`)}
              />
              <StatCard
                label={t("home.stats.shipping")}
                value={String(statsQuery.data.shippingOrderCount)}
                onPress={() =>
                  router.push(`/seller/orders?status=SHIPPING`)
                }
              />
            </View>
            <View className="flex-row gap-2">
              <StatCard
                label={t("home.stats.todaySales")}
                value={formatBaht(statsQuery.data.todaySalesSatang)}
              />
              <StatCard
                label={t("home.stats.last7d")}
                value={formatBaht(statsQuery.data.last7dSalesSatang)}
              />
              <StatCard
                label={t("home.stats.last30d")}
                value={formatBaht(statsQuery.data.last30dSalesSatang)}
              />
            </View>
          </View>
        ) : (
          <View className="py-6">
            <ActivityIndicator color="#e11d48" />
          </View>
        )}

        {/* Action grid */}
        <View className="mx-5 mt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t("home.manage")}
          </Text>
          <View className="mt-2 gap-2">
            <ActionRow
              Icon={Package}
              title={t("home.actions.orders")}
              subtitle={t("home.actions.ordersSub")}
              onPress={() => router.push("/seller/orders")}
            />
            <ActionRow
              Icon={ShoppingBag}
              title={t("home.actions.products")}
              subtitle={t("home.actions.productsSub")}
              onPress={() => router.push("/seller/products")}
            />
            <ActionRow
              Icon={Package2}
              title="Bulk Tracking"
              subtitle="ถ่ายใบเสร็จเป็นกอง · AI กรอกเลขให้ทุกออเดอร์"
              onPress={() => router.push("/seller/shipping/bulk-scan")}
            />
            {/* 911korn 2026-05-27 "ตัดฟีเจอพวกนี้ออกก่อน Hide ไว้ก่อน
                อนาคตค่อยทำ" — Stories / Live / Group Buy เก็บโค้ดไว้
                (route + screens ยังเหมือนเดิม) แต่ซ่อนจากเมนู seller
                สำหรับ TestFlight build แรก. กลับมาเปิดได้ภายหลังด้วย
                การปลด comment บล็อกนี้. */}
            {/*
            <ActionRow
              Icon={Camera}
              title={t("home.actions.stories")}
              subtitle={t("home.actions.storiesSub")}
              onPress={() => router.push("/seller/stories")}
            />
            <ActionRow
              Icon={Radio}
              title={t("home.actions.live")}
              subtitle={t("home.actions.liveSub")}
              onPress={() => router.push("/seller/live")}
            />
            <ActionRow
              Icon={Users}
              title={t("home.actions.groupBuy")}
              subtitle={t("home.actions.groupBuySub")}
              onPress={() => router.push("/seller/group-buys")}
            />
            */}
            <ActionRow
              Icon={MessageSquare}
              title={t("home.actions.chat")}
              subtitle={
                statsQuery.data?.unreadConversationCount
                  ? t("home.actions.chatUnread", { count: statsQuery.data.unreadConversationCount })
                  : t("home.actions.chatSubBusinessOnly")
              }
              badge={statsQuery.data?.unreadConversationCount || undefined}
              onPress={() => router.push("/seller/chat")}
            />
            <ActionRow
              Icon={Globe}
              title={t("home.actions.openShop")}
              subtitle={t("home.actions.openShopSub")}
              onPress={() => router.push(`/s/${activeSlug}`)}
            />
            <ActionRow
              Icon={Palette}
              title={t("home.actions.shopSettings")}
              subtitle={t("home.actions.shopSettingsSub")}
              onPress={() => router.push("/seller/shop-settings")}
            />
            <ActionRow
              Icon={ShieldCheck}
              title={t("home.actions.kyc")}
              subtitle={t("home.actions.kycSub")}
              onPress={() => router.push("/me/kyc")}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
  onPress,
}: {
  label: string;
  value: string;
  tone?: "default" | "urgent" | "warn";
  onPress?: () => void;
}) {
  // Tone is purely visual — drives the border/bg accent so urgent items
  // (pending slips) stand out without yelling at the seller.
  const toneCls =
    tone === "urgent"
      ? "border-rose-200 bg-rose-50"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50"
        : "border-border bg-white";
  const Tag = onPress ? Pressable : View;
  return (
    <Tag
      onPress={onPress}
      className={`flex-1 rounded-2xl border p-3 ${toneCls}`}
    >
      <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </Text>
      <Text
        className={`mt-1 text-[16px] font-bold ${
          tone === "urgent"
            ? "text-rose-700"
            : tone === "warn"
              ? "text-amber-700"
              : "text-fg"
        }`}
        numberOfLines={1}
      >
        {value}
      </Text>
    </Tag>
  );
}

function ActionRow({
  Icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3.5"
    >
      <View className="size-10 items-center justify-center rounded-2xl bg-brand-50">
        <Icon size={20} color="#e11d48" strokeWidth={2} />
      </View>
      <View className="flex-1">
        <Text className="text-[14px] font-semibold text-fg">{title}</Text>
        <Text className="text-[11px] text-muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {badge ? (
        <View className="size-6 items-center justify-center rounded-full bg-rose-600">
          <Text className="text-[10px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : (
        <Text className="text-muted">›</Text>
      )}
    </Pressable>
  );
}
