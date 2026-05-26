import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Share as RNShare,
  Alert,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError, type MePayout } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { getEnv } from "@/lib/env";
import { getAuthToken } from "@/lib/auth";

/**
 * /me/earnings — Affiliate dashboard.
 *
 * Three buckets visualized:
 *   - Pending: PAID/SHIPPING orders (commission accrued, not yet payable)
 *   - Paid:    DELIVERED (locked-in for payout)
 *   - Cancelled: CANCELLED/REFUNDED (clawback)
 *
 * Also offers a "Share my link" button that generates `https://salepage.in.th/?ref=<myUserId>`
 * and opens the native share sheet — that's the primary acquisition loop.
 *
 * The current-user-id we tag onto share links comes from `api.me.profile()`
 * so we never have to guess.
 */
type Bucket = "pending" | "paid" | "cancelled";

export default function EarningsScreen() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    void getAuthToken().then((t) => setAuthed(Boolean(t)));
  }, []);

  const profileQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me.profile(),
    enabled: authed === true,
  });

  const earningsQuery = useQuery({
    queryKey: ["me", "earnings"],
    queryFn: () => api.me.earnings(),
    enabled: authed === true,
  });

  const [activeBucket, setActiveBucket] = useState<Bucket>("paid");
  const [showPayout, setShowPayout] = useState(false);
  const queryClient = useQueryClient();

  async function handleShareLink() {
    if (!profileQuery.data) {
      Alert.alert("ยังโหลดโปรไฟล์ไม่เสร็จ", "ลองอีกครั้งในไม่ช้า");
      return;
    }
    const { webBaseUrl } = getEnv();
    const link = `${webBaseUrl}/?ref=${encodeURIComponent(profileQuery.data.id)}`;
    try {
      await RNShare.share({
        message: `เจอแอปนี้ค่ะ ร้านไทยจ่ายตรงไม่หัก%\n${link}`,
        url: link,
      });
    } catch {
      // user cancelled — fine
    }
  }

  if (authed === false) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-fg">
            เข้าสู่ระบบเพื่อดูรายได้แอฟฟิลิเอต
          </Text>
          <Button
            className="mt-4"
            onPress={() => router.push("/signin?redirect=/me/earnings")}
          >
            เข้าสู่ระบบ
          </Button>
        </View>
      </Screen>
    );
  }

  if (earningsQuery.isLoading || profileQuery.isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  const e = earningsQuery.data;
  const bucket = e?.buckets[activeBucket];
  const filteredOrders = e?.recent.filter((o) => o.bucket === activeBucket) ?? [];

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-32"
        refreshControl={
          <RefreshControl
            refreshing={earningsQuery.isFetching}
            onRefresh={() => void earningsQuery.refetch()}
            tintColor="#e11d48"
          />
        }
      >
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            รายได้แอฟฟิลิเอต
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            แชร์ ร้านขายดี คุณได้คอม
          </Text>
        </View>

        {/* Hero card with payable balance */}
        {e ? (
          <View className="mx-5 mt-4 rounded-3xl bg-emerald-600 p-5">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100">
              ยอดถอนได้ ({e.rate.pct}% ต่อออเดอร์)
            </Text>
            <Text className="mt-1 text-[32px] font-bold text-white">
              {formatBaht(e.balance.payableSatang)}
            </Text>
            <View className="mt-2 flex-row gap-4">
              <View>
                <Text className="text-[10px] uppercase tracking-wider text-emerald-100">
                  รอส่งมอบ
                </Text>
                <Text className="text-[13px] font-semibold text-white">
                  {formatBaht(e.balance.reservedSatang)}
                </Text>
              </View>
              <View>
                <Text className="text-[10px] uppercase tracking-wider text-emerald-100">
                  รอจ่าย
                </Text>
                <Text className="text-[13px] font-semibold text-white">
                  {formatBaht(e.balance.pendingSatang)}
                </Text>
              </View>
              <View>
                <Text className="text-[10px] uppercase tracking-wider text-emerald-100">
                  ตลอดชีพ
                </Text>
                <Text className="text-[13px] font-semibold text-white">
                  {formatBaht(e.lifetime.commissionSatang)}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleShareLink}
              className="mt-4 self-start rounded-full bg-white px-4 py-2"
            >
              <Text className="text-[12px] font-semibold text-emerald-700">
                📤 แชร์ลิงก์รับคอม
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Bucket tabs */}
        {e ? (
          <View className="mx-5 mt-4 flex-row gap-2">
            <BucketTab
              label="รอจ่าย"
              count={e.buckets.pending.count}
              amount={e.buckets.pending.commissionSatang}
              active={activeBucket === "pending"}
              onPress={() => setActiveBucket("pending")}
            />
            <BucketTab
              label="ได้แล้ว"
              count={e.buckets.paid.count}
              amount={e.buckets.paid.commissionSatang}
              active={activeBucket === "paid"}
              tone="success"
              onPress={() => setActiveBucket("paid")}
            />
            <BucketTab
              label="ยกเลิก"
              count={e.buckets.cancelled.count}
              amount={e.buckets.cancelled.commissionSatang}
              active={activeBucket === "cancelled"}
              tone="muted"
              onPress={() => setActiveBucket("cancelled")}
            />
          </View>
        ) : null}

        {/* Bucket detail */}
        {bucket ? (
          <View className="mx-5 mt-3">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              รายละเอียด ({bucket.count})
            </Text>

            {filteredOrders.length === 0 ? (
              <View className="mt-3 items-center rounded-2xl border border-dashed border-border p-8">
                <Text className="text-[12px] text-muted">
                  {activeBucket === "paid"
                    ? "ยังไม่มีคอมมิชชั่นที่ได้แล้ว — แชร์ลิงก์เพื่อเริ่มต้น"
                    : activeBucket === "pending"
                      ? "ยังไม่มีออเดอร์รอจ่าย"
                      : "ไม่มีออเดอร์ยกเลิก"}
                </Text>
              </View>
            ) : (
              <View className="mt-3 gap-2">
                {filteredOrders.map((o) => (
                  <Pressable
                    key={o.orderId}
                    onPress={() => router.push(`/o/${o.token}`)}
                    className="flex-row items-center gap-3 rounded-2xl border border-border bg-white p-3"
                  >
                    <View
                      className="size-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: o.shop.themeColor }}
                    >
                      <Text className="text-[14px] font-bold text-white">
                        {o.shop.logoText ?? o.shop.name.slice(0, 1)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-[12px] font-semibold text-fg"
                        numberOfLines={1}
                      >
                        {o.shop.name}
                      </Text>
                      <Text className="text-[10px] text-muted">
                        {new Date(o.createdAt).toLocaleString("th-TH", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}{" "}
                        · ยอด {formatBaht(o.totalSatang)}
                      </Text>
                    </View>
                    <Text className="text-[14px] font-bold text-emerald-700">
                      +{formatBaht(o.commissionSatang)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* Payouts history */}
        {e && e.payouts.length > 0 ? (
          <View className="mx-5 mt-5">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              ประวัติการขอเบิก
            </Text>
            <View className="mt-2 gap-2">
              {e.payouts.slice(0, 5).map((p) => (
                <PayoutRow key={p.id} payout={p} />
              ))}
              {e.payouts.length > 5 ? (
                <Text className="mt-1 text-center text-[11px] text-muted">
                  + อีก {e.payouts.length - 5} รายการ
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View className="mx-5 mt-4 rounded-2xl border border-dashed border-border p-4">
          <Text className="text-[11px] leading-relaxed text-muted">
            💸 ถอนเงินขั้นต่ำ 50 บาท & จ่ายผ่าน PromptPay ภายใน 1–2 วันทำการ
            หลังจากทีมงานอนุมัติ
          </Text>
        </View>
      </ScrollView>

      {/* Sticky payout CTA — only when payable balance ≥ 50฿ */}
      {e && e.balance.payableSatang >= 5000 ? (
        <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white p-4">
          <Button onPress={() => setShowPayout(true)}>
            ขอรับเงิน {formatBaht(e.balance.payableSatang)}
          </Button>
        </View>
      ) : null}

      {/* Request payout modal */}
      {e ? (
        <RequestPayoutModal
          visible={showPayout}
          payableSatang={e.balance.payableSatang}
          defaultPromptpay={e.payouts[0]?.promptpayId ?? ""}
          onClose={() => setShowPayout(false)}
          onSubmitted={() => {
            setShowPayout(false);
            void earningsQuery.refetch();
            void queryClient.invalidateQueries({
              queryKey: ["me", "earnings"],
            });
          }}
        />
      ) : null}
    </Screen>
  );
}

function PayoutRow({ payout }: { payout: MePayout }) {
  const tone = statusTone(payout.status);
  return (
    <View className="flex-row items-start gap-3 rounded-2xl border border-border bg-white p-3">
      <View className="flex-1">
        <Text className="text-[13px] font-semibold text-fg">
          {formatBaht(payout.amountSatang)}
        </Text>
        <Text className="text-[10px] text-muted">
          PromptPay {payout.promptpayId} ·{" "}
          {new Date(payout.createdAt).toLocaleString("th-TH", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </Text>
        {payout.providerRef ? (
          <Text className="mt-0.5 text-[10px] text-emerald-700">
            ref: {payout.providerRef}
          </Text>
        ) : null}
        {payout.rejectedReason ? (
          <Text className="mt-0.5 text-[10px] text-rose-700">
            {payout.rejectedReason}
          </Text>
        ) : null}
      </View>
      <View
        className={`rounded-full px-2 py-0.5 ${tone.bg}`}
      >
        <Text className={`text-[10px] font-semibold ${tone.text}`}>
          {statusLabel(payout.status)}
        </Text>
      </View>
    </View>
  );
}

function statusTone(status: string): { bg: string; text: string } {
  switch (status) {
    case "REQUESTED":
      return { bg: "bg-amber-100", text: "text-amber-700" };
    case "APPROVED":
      return { bg: "bg-emerald-100", text: "text-emerald-700" };
    case "PAID":
      return { bg: "bg-emerald-50", text: "text-emerald-700" };
    case "REJECTED":
      return { bg: "bg-rose-50", text: "text-rose-700" };
    default:
      return { bg: "bg-zinc-50", text: "text-zinc-600" };
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "REQUESTED":
      return "ขอใหม่";
    case "APPROVED":
      return "อนุมัติ";
    case "PAID":
      return "โอนแล้ว";
    case "REJECTED":
      return "ปฏิเสธ";
    case "CANCELLED":
      return "ยกเลิก";
    default:
      return status;
  }
}

function RequestPayoutModal({
  visible,
  payableSatang,
  defaultPromptpay,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  payableSatang: number;
  defaultPromptpay: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [amountBaht, setAmountBaht] = useState("");
  const [promptpayId, setPromptpayId] = useState(defaultPromptpay);

  // React 19: reset modal fields during render via a guard, not in an effect.
  // The modal is mounted-once-and-toggled, so opening it should reload the
  // current payable balance + saved PromptPay ID.
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  const openKey = visible ? `${payableSatang}|${defaultPromptpay}` : null;
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (visible) {
      setAmountBaht(String(Math.floor(payableSatang / 100)));
      setPromptpayId(defaultPromptpay);
    }
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      const amountSatang = Math.floor(Number(amountBaht.replace(/,/g, "")) * 100);
      return api.me.requestPayout({
        amountSatang,
        promptpayId: promptpayId.trim(),
      });
    },
    onSuccess: () => {
      Alert.alert(
        "รับคำขอแล้ว",
        "ทีมงานตรวจสอบและโอนภายใน 1–2 วันทำการ",
        [{ text: "ตกลง", onPress: onSubmitted }],
      );
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "ส่งล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  const amountSatang = Math.floor(Number(amountBaht.replace(/,/g, "")) * 100);
  const validAmount =
    !Number.isNaN(amountSatang) &&
    amountSatang >= 5000 &&
    amountSatang <= payableSatang;
  const validPromptpay = promptpayId.trim().length >= 4;
  const canSubmit = validAmount && validPromptpay && !submitMutation.isPending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-white p-5">
          <View className="mb-4 items-center">
            <View className="h-1 w-12 rounded-full bg-zinc-200" />
          </View>
          <Text className="text-[18px] font-bold text-fg">ขอรับเงิน</Text>
          <Text className="mt-1 text-[12px] text-muted">
            ยอดที่ถอนได้: {formatBaht(payableSatang)}
          </Text>

          <View className="mt-4 gap-2">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              จำนวนเงิน (บาท)
            </Text>
            <TextInput
              value={amountBaht}
              onChangeText={setAmountBaht}
              keyboardType="numeric"
              placeholder="50"
              className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[16px] text-fg"
            />
            <Text className="text-[10px] text-muted">
              ขั้นต่ำ 50 บาท & ไม่เกิน {(payableSatang / 100).toLocaleString()} บาท
            </Text>
          </View>

          <View className="mt-3 gap-2">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              PromptPay ปลายทาง
            </Text>
            <TextInput
              value={promptpayId}
              onChangeText={setPromptpayId}
              placeholder="เบอร์โทร หรือ เลข ID"
              className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[16px] text-fg"
            />
            <Text className="text-[10px] text-muted">
              ทีมงานจะโอนไปยังบัญชีนี้
            </Text>
          </View>

          <View className="mt-5 flex-row gap-2">
            <Pressable
              onPress={onClose}
              disabled={submitMutation.isPending}
              className="flex-1 items-center justify-center rounded-2xl border border-border bg-white py-3"
            >
              <Text className="text-[14px] font-semibold text-fg">ยกเลิก</Text>
            </Pressable>
            <View className="flex-1">
              <Button
                disabled={!canSubmit}
                onPress={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? "กำลังส่ง..." : "ยืนยันขอเบิก"}
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BucketTab({
  label,
  count,
  amount,
  active,
  tone = "default",
  onPress,
}: {
  label: string;
  count: number;
  amount: number;
  active: boolean;
  tone?: "default" | "success" | "muted";
  onPress: () => void;
}) {
  const activeBg =
    tone === "success"
      ? "border-emerald-300 bg-emerald-50"
      : tone === "muted"
        ? "border-zinc-300 bg-zinc-50"
        : "border-amber-300 bg-amber-50";
  const activeText =
    tone === "success"
      ? "text-emerald-700"
      : tone === "muted"
        ? "text-zinc-600"
        : "text-amber-700";
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-2xl border p-3 ${
        active ? activeBg : "border-border bg-white"
      }`}
    >
      <Text
        className={`text-[10px] font-semibold uppercase tracking-wider ${
          active ? activeText : "text-muted"
        }`}
      >
        {label}
      </Text>
      <Text
        className={`mt-1 text-[14px] font-bold ${
          active ? activeText : "text-fg"
        }`}
        numberOfLines={1}
      >
        {formatBaht(amount)}
      </Text>
      <Text className="mt-0.5 text-[10px] text-muted">
        {count} ออเดอร์
      </Text>
    </Pressable>
  );
}
