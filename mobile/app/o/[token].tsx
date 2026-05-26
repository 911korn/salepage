import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { View, Text, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { formatBaht, orderStatusLabel, formatRelativeTime } from "@/lib/format";
import { detectCourier } from "@/lib/courier-detect";
import type { OrderStatus } from "@/types/api";

const STATUS_FLOW: OrderStatus[] = ["PENDING", "PAID", "SHIPPING", "DELIVERED"];

export default function TrackingScreen() {
  const { t } = useTranslation(["order", "common"]);
  const { token } = useLocalSearchParams<{ token: string }>();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["order", token],
    queryFn: () => api.orders.get(token!),
    enabled: Boolean(token),
    refetchInterval: 15_000,
  });

  // V1.5 Protected Pay: buyer-confirm releases the escrow to the shop. We
  // optimistically refetch on success so the banner immediately flips to
  // "✓ ยืนยันแล้ว".
  const confirmReceived = useMutation({
    mutationFn: () => {
      if (!token) throw new Error("");
      return api.orders.confirmReceived(token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", token] });
      Alert.alert(
        t("tracking.confirmReceivedTitle"),
        t("tracking.confirmReceivedBody"),
      );
    },
    onError: (err) => {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : t("tracking.confirmFailBody");
      Alert.alert(t("tracking.confirmFailTitle"), msg);
    },
  });

  if (isLoading || !data) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  const currentIdx = STATUS_FLOW.indexOf(data.status as OrderStatus);

  return (
    <Screen scroll>
      <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {t("tracking.orderCode")}
        </Text>
        <Text className="font-mono text-[13px] text-fg">{data.publicToken}</Text>
        <Text className="mt-3 text-[24px] font-bold text-brand-700">
          {orderStatusLabel(data.status)}
        </Text>
        <Text className="mt-1 text-[12px] text-muted">
          {t("tracking.createdAt", { when: formatRelativeTime(data.createdAt) })}
        </Text>
      </View>

      {/* Status timeline */}
      <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
        {STATUS_FLOW.map((s, idx) => (
          <TimelineRow
            key={s}
            label={orderStatusLabel(s)}
            done={idx <= currentIdx && currentIdx >= 0}
            current={idx === currentIdx}
            last={idx === STATUS_FLOW.length - 1}
          />
        ))}
      </View>

      {/* Tracking number */}
      {data.trackingNumber ? (
        <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t("tracking.trackingNumber")}
          </Text>
          <Text className="mt-1 font-mono text-[15px] text-fg">
            {data.trackingNumber}
          </Text>
          <Text className="mt-1 text-[12px] text-muted">
            {detectCourier(data.trackingNumber).name}
          </Text>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onPress={() =>
              router.push(
                `/o/${token}/track?n=${encodeURIComponent(data.trackingNumber!)}` as never,
              )
            }
          >
            {t("tracking.openTrackingLink")}
          </Button>
        </View>
      ) : null}

      {/* Items */}
      <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
        <Text className="text-[13px] font-semibold uppercase tracking-wider text-muted">
          {t("tracking.items")}
        </Text>
        {data.items.map((it) => (
          <View
            key={it.productSlug}
            className="mt-3 flex-row justify-between border-t border-border pt-3 first:border-0 first:pt-0"
          >
            <View className="flex-1 pr-3">
              <Text className="text-[14px] text-fg" numberOfLines={2}>
                {it.productName}
              </Text>
              <Text className="mt-0.5 text-[12px] text-muted">×{it.qty}</Text>
            </View>
            <Text className="text-[14px] font-semibold text-fg">
              {formatBaht(it.priceSatang * it.qty)}
            </Text>
          </View>
        ))}
        <View className="mt-4 border-t border-border pt-3">
          <View className="flex-row justify-between">
            <Text className="text-[13px] text-muted">{t("tracking.subtotal")}</Text>
            <Text className="text-[13px] text-fg">
              {formatBaht(data.subtotalSatang)}
            </Text>
          </View>
          {data.shippingSatang > 0 ? (
            <View className="mt-1 flex-row justify-between">
              <Text className="text-[13px] text-muted">{t("tracking.shipping")}</Text>
              <Text className="text-[13px] text-fg">
                {formatBaht(data.shippingSatang)}
              </Text>
            </View>
          ) : null}
          {data.escrowFeeSatang > 0 ? (
            <View className="mt-1 flex-row justify-between">
              <Text className="text-[13px] text-muted">
                🛡️ Protected Pay (1.5%)
              </Text>
              <Text className="text-[13px] text-fg">
                {formatBaht(data.escrowFeeSatang)}
              </Text>
            </View>
          ) : null}
          <View className="mt-2 flex-row justify-between">
            <Text className="text-[15px] font-semibold text-fg">{t("tracking.total")}</Text>
            <Text className="text-[15px] font-bold text-brand-700">
              {formatBaht(data.totalSatang)}
            </Text>
          </View>
        </View>
      </View>

      {/* V1.5 Protected Pay status banner. Shows only on opted-in orders.
          Visually distinct based on lifecycle: HELD (active protection),
          RELEASED/REFUNDED (terminal). DISPUTED gets its own amber pill. */}
      {data.useEscrow && data.escrow ? (
        <EscrowStatusBanner
          escrow={data.escrow}
          buyerConfirmedAt={data.buyerConfirmedAt}
          orderStatus={data.status as OrderStatus}
          onConfirm={() => {
            Alert.alert(
              t("tracking.confirmReceived"),
              t("tracking.confirmFinalBody"),
              [
                { text: t("common:actions.cancel"), style: "cancel" },
                {
                  text: t("tracking.confirmReceived"),
                  style: "destructive",
                  onPress: () => confirmReceived.mutate(),
                },
              ],
            );
          }}
          pending={confirmReceived.isPending}
        />
      ) : null}

      {/* Customer info */}
      <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
        <Text className="text-[13px] font-semibold uppercase tracking-wider text-muted">
          {t("cart:recipient", { defaultValue: t("tracking.recipient") })}
        </Text>
        <Text className="mt-2 text-[14px] text-fg">{data.customerName}</Text>
        {data.customerPhone ? (
          <Text className="text-[13px] text-muted">{data.customerPhone}</Text>
        ) : null}
        {data.customerAddress ? (
          <Text className="mt-1 text-[13px] text-muted">{data.customerAddress}</Text>
        ) : null}
      </View>

      <View className="mx-5 mt-4">
        <Button
          variant="outline"
          loading={isRefetching}
          onPress={() => void refetch()}
        >
          {t("tracking.refresh")}
        </Button>
        {data.status === "PENDING" ? (
          <Button
            className="mt-2"
            onPress={() => router.push(`/checkout/${data.publicToken}`)}
          >
            {t("tracking.shareSlip")}
          </Button>
        ) : null}

        {/* V1.5: post-purchase actions — review + dispute. Both gated on
            slipVerifiedAt because anonymous reviews + disputes need a
            real verified payment trail. */}
        {(data.status === "SHIPPING" || data.status === "DELIVERED") &&
        data.slipVerifiedAt ? (
          <Button
            className="mt-2"
            variant="outline"
            onPress={() =>
              router.push({
                pathname: "/o/[token]/review",
                params: { token: data.publicToken },
              })
            }
          >
            {t("tracking.review")}
          </Button>
        ) : null}

        {data.status !== "PENDING" && data.status !== "CANCELLED" ? (
          <Button
            className="mt-2"
            variant="outline"
            onPress={() =>
              router.push({
                pathname: "/o/[token]/dispute",
                params: { token: data.publicToken },
              })
            }
          >
            {t("tracking.openDispute")}
          </Button>
        ) : null}
      </View>
    </Screen>
  );
}

/**
 * V1.5 Protected Pay status banner for the order tracking screen.
 *
 *   HELD      → emerald banner with countdown copy. Buyer-confirm CTA only
 *               shown once DELIVERED (otherwise it's premature).
 *   DISPUTED  → amber banner explaining funds are frozen pending resolution.
 *   RELEASED  → muted green banner with the close reason for transparency.
 *   REFUNDED  → muted slate banner explaining the buyer was refunded.
 */
function EscrowStatusBanner({
  escrow,
  buyerConfirmedAt,
  orderStatus,
  onConfirm,
  pending,
}: {
  escrow: NonNullable<
    Awaited<ReturnType<typeof api.orders.get>>["escrow"]
  >;
  buyerConfirmedAt: string | null;
  orderStatus: OrderStatus;
  onConfirm: () => void;
  pending: boolean;
}) {
  const canConfirm =
    escrow.status === "HELD" &&
    orderStatus === "DELIVERED" &&
    !buyerConfirmedAt;
  const tone =
    escrow.status === "HELD"
      ? { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900" }
      : escrow.status === "DISPUTED"
        ? { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900" }
        : escrow.status === "RELEASED"
          ? { bg: "bg-zinc-50", border: "border-zinc-200", text: "text-zinc-700" }
          : { bg: "bg-zinc-50", border: "border-zinc-200", text: "text-zinc-700" };
  const headline =
    escrow.status === "HELD"
      ? "🛡️ Protected Pay กำลังกักเงิน"
      : escrow.status === "DISPUTED"
        ? "⚠️ เงินถูกระงับ — ระหว่างพิจารณาข้อพิพาท"
        : escrow.status === "RELEASED"
          ? "✓ ปล่อยเงินให้ร้านแล้ว"
          : "↩️ คืนเงินให้ผู้ซื้อแล้ว";
  const body =
    escrow.status === "HELD"
      ? orderStatus === "DELIVERED"
        ? "กดยืนยันรับสินค้าเพื่อปล่อยเงิน หรือรอครบ 72 ชม. ระบบจะปล่อยอัตโนมัติ"
        : "เงินจะถูกปล่อยให้ร้านหลังคุณได้รับสินค้าแล้ว 72 ชั่วโมง"
      : escrow.status === "DISPUTED"
        ? "ทีมงานกำลังพิจารณา — ผลตัดสินจะปล่อยเงินให้ร้านหรือคืนให้คุณ"
        : escrow.status === "RELEASED"
          ? buyerConfirmedAt
            ? "คุณยืนยันรับสินค้า — ขอบคุณค่ะ/ครับ"
            : "ระบบปล่อยอัตโนมัติหลังครบ 72 ชม."
          : "เงินจะกลับเข้าบัญชี 1–3 วันทำการ";
  return (
    <View className={`mx-5 mt-4 rounded-3xl border ${tone.bg} ${tone.border} p-5`}>
      <Text className={`text-[14px] font-bold ${tone.text}`}>{headline}</Text>
      <Text className={`mt-1 text-[12px] leading-relaxed ${tone.text} opacity-80`}>
        {body}
      </Text>
      <View className="mt-2 flex-row items-baseline gap-1">
        <Text className={`text-[11px] uppercase tracking-wider ${tone.text} opacity-60`}>
          เงินกัก
        </Text>
        <Text className={`text-[13px] font-semibold ${tone.text}`}>
          {formatBaht(escrow.amountSatang)}
        </Text>
      </View>
      {canConfirm ? (
        <Button
          className="mt-3"
          loading={pending}
          disabled={pending}
          onPress={onConfirm}
        >
          ยืนยันได้รับสินค้า
        </Button>
      ) : null}
    </View>
  );
}

function TimelineRow({
  label,
  done,
  current,
  last,
}: {
  label: string;
  done: boolean;
  current: boolean;
  last: boolean;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View
          className={`size-5 items-center justify-center rounded-full ${
            done ? "bg-brand-600" : "border border-border bg-white"
          }`}
        >
          {done ? <Text className="text-[10px] text-white">✓</Text> : null}
        </View>
        {!last ? (
          <View className={`mt-1 h-8 w-0.5 ${done ? "bg-brand-300" : "bg-border"}`} />
        ) : null}
      </View>
      <Text
        className={`mt-0 text-[14px] ${
          current ? "font-bold text-fg" : done ? "text-fg" : "text-muted"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
