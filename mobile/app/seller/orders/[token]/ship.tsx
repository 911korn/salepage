import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { formatBaht } from "@/lib/format";

/**
 * /seller/orders/[token]/ship — Shopee-style EasyParcel flow.
 *
 *   1. Seller types parcel weight (gram). Default 500g.
 *   2. POST /shipment/quote returns the courier rate list — render
 *      as a card stack sorted cheapest first.
 *   3. Seller picks one → POST /shipment/buy → returns AWB + PDF URL.
 *   4. Show success screen with "เปิดใบปะหน้า" CTA that opens the PDF
 *      in the system browser for printing. Order auto-flips SHIPPING.
 *
 * Pro-gated — server returns 402 "pro_required" if seller isn't on
 * a paid plan. We surface that as an alert with a link to /billing.
 */
export default function SellerShipScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [weight, setWeight] = useState("500");
  const [pickedRef, setPickedRef] = useState<string | null>(null);
  const [purchased, setPurchased] = useState<{
    awb: string;
    pdf: string;
    courier: string;
  } | null>(null);

  const weightGram = Math.max(100, Math.min(50_000, Number(weight) || 0));

  const quoteQuery = useQuery({
    queryKey: ["shipment", "quote", token, weightGram],
    queryFn: () => api.orders.shipmentQuote(token!, { weightGram }),
    enabled: Boolean(token) && weightGram >= 100,
    staleTime: 60_000,
  });

  const buyMutation = useMutation({
    mutationFn: () => {
      const rate = quoteQuery.data?.rates.find((r) => r.rateRef === pickedRef);
      if (!rate || !token) throw new Error("กรุณาเลือก courier ก่อน");
      return api.orders.shipmentBuy(token, {
        rateRef: rate.rateRef,
        courierCode: rate.courierCode,
        courierName: rate.courierName,
        serviceName: rate.serviceName,
        weightGram,
        shippingFeeSatang: rate.priceSatang,
      });
    },
    onSuccess: (res) => {
      setPurchased({
        awb: res.awbNumber,
        pdf: res.labelPdfUrl,
        courier: res.courierName,
      });
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "ออกใบปะหน้าไม่สำเร็จ";
      if (e instanceof ApiClientError && e.message.includes("Pro")) {
        Alert.alert("ต้องอัปเกรด Pro", msg, [
          { text: "ยกเลิก", style: "cancel" },
          { text: "ดูแผน Pro", onPress: () => router.push("/me") },
        ]);
        return;
      }
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  if (purchased) {
    return (
      <Screen>
        <ScrollView contentContainerClassName="px-5 pb-32 pt-6">
          <View className="rounded-3xl bg-emerald-50 border border-emerald-200 p-5">
            <Text className="text-[18px] font-bold text-emerald-900">
              ออกใบปะหน้าสำเร็จ
            </Text>
            <Text className="mt-1 text-[13px] text-emerald-700">
              เลขพัสดุของ {purchased.courier}
            </Text>
            <Text className="mt-2 font-mono text-[18px] font-bold text-emerald-900">
              {purchased.awb}
            </Text>
          </View>
          <View className="mt-4 gap-2">
            <Button onPress={() => void Linking.openURL(purchased.pdf)}>
              เปิดใบปะหน้า (PDF) เพื่อปริ๊น →
            </Button>
            <Text className="text-center text-[11px] leading-relaxed text-muted">
              ปริ๊นใบปะหน้า ติดที่กล่อง แล้วเอาไป drop-off ที่จุดรับของ
              {" "}{purchased.courier}{" "}— ระบบจะอัปเดตสถานะให้ลูกค้าอัตโนมัติเมื่อ
              courier scan เข้าระบบ
            </Text>
          </View>
          <Button
            variant="outline"
            className="mt-4"
            onPress={() => router.replace("/seller/orders")}
          >
            กลับไปหน้าออเดอร์
          </Button>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-32 pt-6">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          ออกใบปะหน้าอัตโนมัติ
        </Text>
        <Text className="mt-1 text-[20px] font-bold text-fg">
          เลือกขนส่ง → ปริ๊น → drop-off
        </Text>
        <Text className="mt-1 text-[12px] leading-relaxed text-muted">
          ระบบเชื่อมตรงกับ EasyParcel · ค่าส่งจ่ายที่เคาน์เตอร์ courier ตอน
          drop-off
        </Text>

        <View className="mt-5 rounded-2xl border border-border bg-white px-4 py-3">
          <Text className="text-[11px] text-muted">น้ำหนักพัสดุ (กรัม)</Text>
          <TextInput
            value={weight}
            onChangeText={(v) => {
              setWeight(v.replace(/[^\d]/g, ""));
              setPickedRef(null);
            }}
            keyboardType="number-pad"
            maxLength={5}
            placeholder="500"
            className="mt-1 text-[20px] font-bold text-fg"
          />
        </View>

        {quoteQuery.isLoading ? (
          <View className="mt-5 items-center py-8">
            <ActivityIndicator color="#e11d48" />
            <Text className="mt-2 text-[12px] text-muted">กำลังเช็คราคา...</Text>
          </View>
        ) : quoteQuery.error ? (
          <ErrorBlock err={quoteQuery.error} />
        ) : quoteQuery.data ? (
          <View className="mt-5 gap-2">
            {quoteQuery.data.rates.map((r) => {
              const isPicked = pickedRef === r.rateRef;
              return (
                <Pressable
                  key={r.rateRef}
                  onPress={() => setPickedRef(r.rateRef)}
                  className={`rounded-2xl border p-4 ${
                    isPicked
                      ? "border-brand-600 bg-brand-50"
                      : "border-border bg-white"
                  }`}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-[14px] font-bold text-fg">
                        {r.courierName}
                      </Text>
                      <Text className="text-[11px] text-muted">
                        {r.serviceName} · ส่ง {r.etaDays} วัน
                      </Text>
                    </View>
                    <Text className="text-[16px] font-bold text-brand-700">
                      {formatBaht(r.priceSatang)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Button
          className="mt-6"
          disabled={!pickedRef || buyMutation.isPending}
          onPress={() => buyMutation.mutate()}
        >
          {buyMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            "ยืนยัน · ออกใบปะหน้า"
          )}
        </Button>
      </ScrollView>
    </Screen>
  );
}

function ErrorBlock({ err }: { err: unknown }) {
  const msg =
    err instanceof ApiClientError
      ? err.message
      : "เช็คราคาไม่สำเร็จ ลองอีกครั้ง";
  return (
    <View className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <Text className="text-[12px] text-rose-700">{msg}</Text>
    </View>
  );
}
