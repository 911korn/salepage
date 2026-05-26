import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import {
  useCart,
  selectSubtotalSatang,
  shopsToList,
  selectShopCount,
  type CartLine,
} from "@/store/cart";
import { formatBaht } from "@/lib/format";
import { api } from "@/lib/api";
import { ApiClientError } from "@/lib/api";
import { AddressPicker } from "@/components/address-picker";
import { CouponLoyaltyPanel } from "@/components/coupon-loyalty-panel";
import { getActiveReferrer } from "@/lib/affiliate";

export default function CartScreen() {
  const { t } = useTranslation(["cart", "common"]);
  // Subscribe to the raw shops map (reference-stable until the store
  // actually mutates). Compute the derived shopList via useMemo so the
  // array reference is stable across re-renders. Using selectShopList
  // as a Zustand selector would loop (it builds new objects each call;
  // Object.is would treat every call as a change) — 911korn 2026-05-27
  // IMG_5241 "Maximum update depth exceeded".
  const shops = useCart((s) => s.shops);
  const shopList = useMemo(() => shopsToList(shops), [shops]);
  const shopCount = useCart(selectShopCount);
  const grandTotal = useCart(selectSubtotalSatang);
  const setQty = useCart((s) => s.setQty);
  const removeLine = useCart((s) => s.removeLine);
  const removeShop = useCart((s) => s.removeShop);
  const clear = useCart((s) => s.clear);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  // Per-shop notes — keyed by shopSlug. Sent through to the order so the
  // shop sees customer-specific instructions ("รอฝากหน้าร้าน", "ไม่บีบขนาด", etc.).
  // Cleared automatically when the shop is removed from the cart.
  const [shopNotes, setShopNotes] = useState<Record<string, string>>({});
  // V1.5 Protected Pay opt-in per-shop. Defaults to false to avoid surprising
  // users with an extra 1.5% fee; they explicitly toggle it on when they want
  // escrow protection. Cleared when the shop is removed.
  const [shopProtect, setShopProtect] = useState<Record<string, boolean>>({});
  // V1.1: per-shop coupon + loyalty. Each shop runs its own coupon catalog +
  // loyalty wallet in our schema, so the cart tracks discounts shop-by-shop.
  // The single-shop case is just `shopList.length === 1` over the same maps.
  const [couponInputs, setCouponInputs] = useState<Record<string, string>>({});
  const [appliedCoupons, setAppliedCoupons] = useState<
    Record<string, { code: string; discountSatang: number } | null>
  >({});
  const [redeemPointsByShop, setRedeemPointsByShop] = useState<
    Record<string, number>
  >({});

  // Escrow fee preview for the summary section. Server is authoritative on
  // the actual charge — this is just display.
  const escrowFeeTotal = shopList.reduce((sum, shop) => {
    if (!shopProtect[shop.shopSlug]) return sum;
    const couponDiscount =
      appliedCoupons[shop.shopSlug]?.discountSatang ?? 0;
    const pointsDiscount = (redeemPointsByShop[shop.shopSlug] ?? 0) * 100;
    const postDiscount = Math.max(
      0,
      shop.subtotalSatang - couponDiscount - pointsDiscount,
    );
    return sum + Math.ceil((postDiscount * 150) / 10_000);
  }, 0);

  // After any subtotal/coupon change we recompute the final payable amount.
  // Server is authoritative on order create; this is just for display.
  const couponDiscountTotal = shopList.reduce(
    (sum, shop) =>
      sum + (appliedCoupons[shop.shopSlug]?.discountSatang ?? 0),
    0,
  );
  const loyaltyDiscountTotal = shopList.reduce(
    (sum, shop) => sum + (redeemPointsByShop[shop.shopSlug] ?? 0) * 100,
    0,
  );
  const finalTotal = Math.max(
    0,
    grandTotal - couponDiscountTotal - loyaltyDiscountTotal,
  );

  const isSingleShop = shopList.length === 1;
  const singleShop = isSingleShop ? shopList[0]! : null;

  const createOrders = useMutation({
    mutationFn: () => {
      if (shopList.length === 0) throw new Error("ตะกร้าว่าง");
      // Branch on cart shape: single-shop calls /orders (the historical entry
      // point with side-effects like saved-address upsert + customer email
      // notifications), multi-shop uses the atomic /orders/multi route.
      if (isSingleShop && singleShop) {
        return (async () => {
          // Pull the affiliate ref captured by the deep-link handler — null
          // if the user opened the app directly or the 30d window expired.
          const referrer = await getActiveReferrer();
          const slug = singleShop.shopSlug;
          const points = redeemPointsByShop[slug] ?? 0;
          return api.orders.create({
            shopSlug: slug,
            items: singleShop.items.map((it) => ({
              productSlug: it.productSlug,
              qty: it.qty,
            })),
            customerName: name.trim(),
            customerPhone: phone.trim() || undefined,
            customerAddress: address.trim() || undefined,
            notes: shopNotes[slug]?.trim() || undefined,
            couponCode: appliedCoupons[slug]?.code || undefined,
            redeemPoints: points > 0 ? points : undefined,
            referrerUserId: referrer?.userId,
            referrerCode: referrer?.code,
            useEscrow: shopProtect[slug] || undefined,
          });
        })().then((res) => ({
          orders: [
            {
              shopSlug: singleShop.shopSlug,
              shopName: singleShop.shopName,
              orderId: res.orderId,
              token: res.token,
              trackingUrl: res.trackingUrl,
              totalSatang: 0,
              qr: res.qr,
            },
          ],
        }));
      }
      return (async () => {
        const referrer = await getActiveReferrer();
        return api.orders.createMulti({
          customerName: name.trim(),
          customerPhone: phone.trim() || undefined,
          customerAddress: address.trim() || undefined,
          shops: shopList.map((shop) => {
            const points = redeemPointsByShop[shop.shopSlug] ?? 0;
            return {
              shopSlug: shop.shopSlug,
              items: shop.items.map((it) => ({
                productSlug: it.productSlug,
                qty: it.qty,
              })),
              notes: shopNotes[shop.shopSlug]?.trim() || undefined,
              useEscrow: shopProtect[shop.shopSlug] || undefined,
              couponCode:
                appliedCoupons[shop.shopSlug]?.code || undefined,
              redeemPoints: points > 0 ? points : undefined,
            };
          }),
          referrerUserId: referrer?.userId,
          referrerCode: referrer?.code,
        });
      })();
    },
    onSuccess: (res) => {
      clear();
      // Single-shop bag → jump straight into the existing checkout flow.
      // Multi-shop bag → land on the multi-tab checkout page.
      if (res.orders.length === 1) {
        router.replace(`/checkout/${res.orders[0]!.token}`);
      } else {
        const tokens = res.orders.map((o) => o.token).join(",");
        router.replace({
          pathname: "/checkout/multi",
          params: { tokens },
        });
      }
    },
    onError: (err) => {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : t("createOrderError");
      Alert.alert(t("errorAlertTitle"), msg);
    },
  });

  // Reset coupon + loyalty when the cart shape changes (e.g. user added a 2nd
  // shop, or removed one of the lines). Stale codes would error out on submit.
  // React 19: reset during render via a guard, not inside an effect, so we
  // don't trigger a second render pass.
  const cartShapeKey = useMemo(
    () =>
      shopList.map((s) => `${s.shopSlug}:${s.subtotalSatang}`).join("|"),
    [shopList],
  );
  const [lastShapeKey, setLastShapeKey] = useState(cartShapeKey);
  if (lastShapeKey !== cartShapeKey) {
    setLastShapeKey(cartShapeKey);
    // Only call the resets when there's something to clear — empty-object
    // re-assignments still create a new reference and force another render
    // pass for no gain.
    if (Object.keys(appliedCoupons).length > 0) setAppliedCoupons({});
    if (Object.keys(redeemPointsByShop).length > 0) setRedeemPointsByShop({});
    if (Object.keys(couponInputs).length > 0) setCouponInputs({});
  }

  if (shopList.length === 0) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-fg">{t("empty")}</Text>
          <Button className="mt-4" variant="outline" onPress={() => router.back()}>
            {t("continueShopping")}
          </Button>
        </View>
      </Screen>
    );
  }

  const canCheckout = name.trim().length >= 2;

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t("title")}
          </Text>
          <Text className="text-[15px] font-semibold text-fg">
            {shopCount === 1
              ? t("shopOnly", { name: shopList[0]!.shopName })
              : t("shopCount", { count: shopCount })}
          </Text>
        </View>

        {/* One section per shop */}
        {shopList.map((shop) => (
          <View
            key={shop.shopSlug}
            className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white"
          >
            <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
              <View className="flex-1">
                <Text
                  className="text-[13px] font-semibold text-fg"
                  numberOfLines={1}
                >
                  {shop.shopName}
                </Text>
                <Text className="text-[11px] text-muted">
                  {t("shop:productCount", { count: shop.items.length })} · {formatBaht(shop.subtotalSatang)}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert(
                    t("removeShopTitle"),
                    t("removeShopBody", { count: shop.items.length }),
                    [
                      { text: t("common:actions.cancel"), style: "cancel" },
                      {
                        text: t("removeShopAction"),
                        style: "destructive",
                        onPress: () => removeShop(shop.shopSlug),
                      },
                    ],
                  )
                }
                hitSlop={8}
              >
                <Text className="text-[12px] text-rose-600">{t("removeShop")}</Text>
              </Pressable>
            </View>
            {shop.items.map((it, idx) => (
              <CartLineRow
                key={it.productSlug}
                line={it}
                showDivider={idx > 0}
                onIncrement={() =>
                  setQty(shop.shopSlug, it.productSlug, it.qty + 1)
                }
                onDecrement={() =>
                  setQty(shop.shopSlug, it.productSlug, it.qty - 1)
                }
                onRemove={() => removeLine(shop.shopSlug, it.productSlug)}
              />
            ))}
            {/* V1.5 Protected Pay toggle per-shop. We always show the row — if
                the shop opted out, the server returns 409 and we surface the
                error in onError. UX-wise it's clearer than silently hiding. */}
            <ProtectedPayToggle
              enabled={Boolean(shopProtect[shop.shopSlug])}
              shopSubtotal={shop.subtotalSatang}
              onToggle={(next) =>
                setShopProtect((prev) => ({
                  ...prev,
                  [shop.shopSlug]: next,
                }))
              }
            />
            {/* V1.1 per-shop coupon + loyalty. Each shop runs its own catalog
                + wallet so this panel is repeated for every shop in the bag. */}
            <View className="border-t border-border">
              <CouponLoyaltyPanel
                shopSlug={shop.shopSlug}
                phone={phone.trim()}
                subtotalSatang={shop.subtotalSatang}
                appliedCoupon={appliedCoupons[shop.shopSlug] ?? null}
                couponInput={couponInputs[shop.shopSlug] ?? ""}
                redeemPoints={redeemPointsByShop[shop.shopSlug] ?? 0}
                onCouponInputChange={(v) =>
                  setCouponInputs((prev) => ({ ...prev, [shop.shopSlug]: v }))
                }
                onApplyCoupon={(c) => {
                  setAppliedCoupons((prev) => ({
                    ...prev,
                    [shop.shopSlug]: c,
                  }));
                  if (c) {
                    setCouponInputs((prev) => ({
                      ...prev,
                      [shop.shopSlug]: c.code,
                    }));
                  }
                }}
                onRedeemPointsChange={(n) =>
                  setRedeemPointsByShop((prev) => ({
                    ...prev,
                    [shop.shopSlug]: n,
                  }))
                }
              />
            </View>
            {/* Per-shop note. Optional. Maps to `Order.notes` server-side
                so the shop sees it in the seller dashboard. */}
            <View className="border-t border-border px-4 py-3">
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t("noteToShop")}
              </Text>
              <TextInput
                value={shopNotes[shop.shopSlug] ?? ""}
                onChangeText={(text) =>
                  setShopNotes((prev) => ({
                    ...prev,
                    [shop.shopSlug]: text,
                  }))
                }
                placeholder={t("notePlaceholder")}
                multiline
                maxLength={500}
                className="mt-1 rounded-xl border border-border bg-white px-3 py-2 text-[13px] text-fg"
                style={{ minHeight: 60, textAlignVertical: "top" }}
              />
            </View>
          </View>
        ))}

        <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
          <Text className="text-[13px] font-semibold uppercase tracking-wider text-muted">
            {t("recipient")}
          </Text>
          <FieldInput
            label={t("nameLabel")}
            value={name}
            onChangeText={setName}
            placeholder={t("namePlaceholder")}
          />
          <FieldInput
            label={t("phoneLabel")}
            value={phone}
            onChangeText={setPhone}
            placeholder={t("phonePlaceholder")}
            keyboardType="phone-pad"
          />
          {/* Postcode-driven autocomplete (V0.5 polish). Composes the final
              address string before we POST so the server gets a single field. */}
          <AddressPicker value={address} onChange={setAddress} />
        </View>

        <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
          {shopList.map((shop) => (
            <Row
              key={shop.shopSlug}
              label={shop.shopName}
              value={formatBaht(shop.subtotalSatang)}
            />
          ))}
          {couponDiscountTotal > 0 ? (
            <Row
              label={t("totalCoupon")}
              value={`-${formatBaht(couponDiscountTotal)}`}
            />
          ) : null}
          {loyaltyDiscountTotal > 0 ? (
            <Row
              label={t("totalLoyalty")}
              value={`-${formatBaht(loyaltyDiscountTotal)}`}
            />
          ) : null}
          {escrowFeeTotal > 0 ? (
            <Row
              label={t("protectedPayFee")}
              value={`+${formatBaht(escrowFeeTotal)}`}
            />
          ) : null}
          <View className="mt-3 border-t border-border pt-3">
            <Row
              label={t("totalLabel")}
              value={formatBaht(finalTotal + escrowFeeTotal)}
              bold
            />
          </View>
          {shopCount > 1 ? (
            <Text className="mt-3 text-[11px] leading-relaxed text-muted">
              {t("multiShopHint", { count: shopCount })}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white px-4 py-3 pb-6">
        <Button
          loading={createOrders.isPending}
          disabled={!canCheckout || createOrders.isPending}
          onPress={() => createOrders.mutate()}
        >
          {t("confirmOrder", { amount: formatBaht(finalTotal + escrowFeeTotal) })}
        </Button>
      </View>
    </Screen>
  );
}

function CartLineRow({
  line,
  showDivider,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  line: CartLine;
  showDivider: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("common");
  const remove = t("actions.delete");
  return (
    <View
      className={`flex-row gap-3 p-3 ${showDivider ? "border-t border-border" : ""}`}
    >
      <View className="size-16 overflow-hidden rounded-xl bg-soft">
        {line.imageUrl ? (
          <Image
            source={{ uri: line.imageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : null}
      </View>
      <View className="flex-1">
        <Text className="text-[14px] font-medium text-fg" numberOfLines={2}>
          {line.productName}
        </Text>
        <Text className="mt-1 text-[14px] font-bold text-brand-700">
          {formatBaht(line.priceSatang)}
        </Text>
        <View className="mt-2 flex-row items-center gap-3">
          <QtyButton onPress={onDecrement} label="−" />
          <Text className="min-w-6 text-center text-[14px] font-semibold">
            {line.qty}
          </Text>
          <QtyButton onPress={onIncrement} label="+" />
          <Pressable onPress={onRemove} className="ml-auto" hitSlop={6}>
            <Text className="text-[12px] text-rose-600">{remove}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * V1.5 Protected Pay toggle. Always visible. Shows the buyer-paid fee preview
 * so they understand what they're opting into. Mirrors `ESCROW_FEE_BPS = 150`
 * on the server (1.5%, rounded up to satang).
 */
function ProtectedPayToggle({
  enabled,
  shopSubtotal,
  onToggle,
}: {
  enabled: boolean;
  shopSubtotal: number;
  onToggle: (next: boolean) => void;
}) {
  const { t } = useTranslation("cart");
  const feeSatang = Math.ceil((shopSubtotal * 150) / 10_000);
  return (
    <Pressable
      onPress={() => onToggle(!enabled)}
      className={`flex-row items-center gap-3 border-t border-border px-4 py-3 ${
        enabled ? "bg-emerald-50/60" : ""
      }`}
    >
      <View
        className={`size-5 items-center justify-center rounded-md border-2 ${
          enabled ? "border-emerald-600 bg-emerald-600" : "border-border bg-white"
        }`}
      >
        {enabled ? (
          <Text className="text-[10px] font-bold text-white">✓</Text>
        ) : null}
      </View>
      <View className="flex-1">
        <Text className="text-[13px] font-semibold text-fg">
          {t("protectedPayLabel", { fee: formatBaht(feeSatang) })}
        </Text>
        <Text className="mt-0.5 text-[11px] leading-relaxed text-muted">
          {t("protectedPayHint")}
        </Text>
      </View>
    </Pressable>
  );
}

function QtyButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      className="size-7 items-center justify-center rounded-lg border border-border bg-soft"
    >
      <Text className="text-[16px] font-semibold text-fg">{label}</Text>
    </Pressable>
  );
}

function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View className="mt-3">
      <Text className="text-[12px] text-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        className={`mt-1 rounded-xl border border-border bg-white px-3 py-2 text-[15px] text-fg ${
          multiline ? "min-h-[80px]" : ""
        }`}
        textAlignVertical={multiline ? "top" : "auto"}
      />
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className={`${bold ? "text-[15px] font-semibold" : "text-[13px]"} text-fg`}>
        {label}
      </Text>
      <Text className={`${bold ? "text-[15px] font-bold text-brand-700" : "text-[13px] text-fg"}`}>
        {value}
      </Text>
    </View>
  );
}
