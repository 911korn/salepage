import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Clipboard,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Printer, Camera, CheckCircle2, Copy, Receipt, ExternalLink } from "lucide-react-native";
import { detectCourier } from "@/lib/courier-detect";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { compressForSlipUpload } from "@/lib/image-compress";
import { getEnv } from "@/lib/env";
import { Sentry } from "@/lib/sentry";

/**
 * /seller/orders/[token]/ship — V2.1 Drop-off + AI Tracking flow.
 *
 * Replaces the EasyParcel-only Pro flow. Free for every seller —
 * 911korn 2026-05-27 "ใส่ระบบนี้ไปให้ทุก tier ได้เลยตั้งแต่ฟรี
 * เป็นจุดขายเลย".
 *
 *   1. Tap "พิมพ์ใบปะหน้า" → opens our printable HTML label in the
 *      system browser. Seller hits Print → tapes label on parcel.
 *   2. Drops parcel at ANY courier (Flash/Kerry/J&T/Thai Post),
 *      pays cash. Courier prints receipt with tracking#.
 *   3. Tap "ถ่ายรูปใบเสร็จ" → camera → Claude vision OCR extracts
 *      {trackingNumber, receiverName, courier}, matches the order's
 *      customer name, auto-fills tracking + flips PAID→SHIPPING.
 */
export default function SellerShipScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { apiBaseUrl } = getEnv();

  // Pull the order so we know the current tracking status — if the
  // seller comes back to this screen after the AI scan already fired,
  // we surface the success card instead of letting them re-scan.
  const orderQuery = useQuery({
    queryKey: ["order", token],
    queryFn: () => api.orders.get(token!),
    enabled: Boolean(token),
    refetchInterval: false,
  });

  const [pendingScan, setPendingScan] = useState<{
    receiverName: string | null;
    trackingNumber: string;
    receiptUrl: string;
    message: string;
    /** Base64 of the receipt photo we already sent. We re-use it for
     *  the seller's "ยืนยัน" tap so the camera never reopens after
     *  the first capture (911korn 2026-05-27 "กดยืนยันแล้วมันให้ถ่าย
     *  รูปซ้ำ"). */
    dataBase64: string;
  } | null>(null);
  const [scannedNow, setScannedNow] = useState<{
    trackingNumber: string;
    courier: string | null;
  } | null>(null);

  const labelUrl = token
    ? `${apiBaseUrl.replace(/\/$/, "")}/api/v1/orders/${token}/shipment/label`
    : null;

  // Last captured base64 — kept so a "ยืนยัน" tap can resend without
  // re-opening the camera (the original bug). Cleared once we shift to
  // the success view.
  const [lastBase64, setLastBase64] = useState<string | null>(null);

  const scanMutation = useMutation({
    mutationFn: async (input: { dataBase64: string; override: boolean }) => {
      if (!token) throw new Error("missing token");
      return api.orders.scanShippingReceipt(token, {
        dataBase64: input.dataBase64,
        contentType: "image/jpeg",
        confirmOverride: input.override,
      });
    },
    onSuccess: (res) => {
      if (res.ok) {
        setScannedNow({
          trackingNumber: res.trackingNumber,
          courier: res.courier,
        });
        setPendingScan(null);
        setLastBase64(null);
        void orderQuery.refetch();
        // Linger long enough on the success card for the seller to read
        // the tracking + courier name before we drop them back on the
        // orders list to pick the next ship-out (911korn 2026-05-27
        // "ต้องไป Success page และ จบ ไปทำงานต่อไป").
        setTimeout(() => router.replace("/seller/orders"), 2500);
        return;
      }
      if (res.reason === "name_mismatch" && res.scan.trackingNumber) {
        setPendingScan({
          receiverName: res.scan.receiverName,
          trackingNumber: res.scan.trackingNumber,
          receiptUrl: res.receiptUrl,
          message: res.message,
          dataBase64: lastBase64 ?? "",
        });
        return;
      }
      Alert.alert("AI อ่านใบเสร็จไม่สำเร็จ", res.message);
    },
    onError: (err) => {
      Sentry.captureException(err);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof ApiClientError ? err.message : "ลองอีกครั้ง",
      );
    },
  });

  /**
   * Capture a fresh receipt photo and run the first scan. Separate from
   * scanMutation so the "ยืนยัน" tap can resubmit the cached image
   * without ever reopening the camera.
   */
  async function takePhotoAndScan() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("ต้องการสิทธิ์ใช้กล้อง", "เปิดในการตั้งค่า > SalePage");
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (shot.canceled || !shot.assets[0]) return;
    try {
      const { base64 } = await compressForSlipUpload(shot.assets[0].uri);
      setLastBase64(base64);
      scanMutation.mutate({ dataBase64: base64, override: false });
    } catch (err) {
      Sentry.captureException(err);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof ApiClientError ? err.message : "ประมวลผลรูปไม่สำเร็จ",
      );
    }
  }

  const order = orderQuery.data;
  const trackingNumber = scannedNow?.trackingNumber ?? order?.trackingNumber;
  const isShipped = Boolean(trackingNumber);

  if (orderQuery.isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  if (isShipped) {
    const receiptUrl = order?.shippingReceiptUrl ?? null;
    return (
      <Screen>
        <ScrollView contentContainerClassName="px-5 pt-10 pb-32">
          <View className="items-center">
            <View className="size-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 size={48} color="#047857" strokeWidth={2.2} />
            </View>
            <Text className="mt-4 text-[20px] font-bold text-emerald-900">
              เสร็จเรียบร้อย!
            </Text>
            <Text className="mt-1 text-center text-[13px] leading-relaxed text-muted">
              ลูกค้าได้รับ email + LINE แจ้งเลขพัสดุแล้ว
            </Text>
          </View>

          {/* Tracking number + copy + check status (911korn 2026-05-27
              "พร้อมโชว์ เลข Tracking แบบ มีปุ่ม copy + Check Status
              auto-fill ค่ายนั้นๆ ไปเลย"). Courier resolved from the
              tracking-number regex so the link always lands on the
              right courier's tracking page. */}
          {(() => {
            const courier = detectCourier(trackingNumber!);
            return (
              <View className="mt-6 rounded-3xl bg-zinc-900 p-5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    เลขพัสดุ
                  </Text>
                  <Text className="text-[11px] font-semibold text-zinc-300">
                    {courier.name}
                  </Text>
                </View>
                <View className="mt-1 flex-row items-center gap-2">
                  <Text
                    className="flex-1 font-mono text-[20px] font-bold text-white"
                    numberOfLines={1}
                  >
                    {trackingNumber}
                  </Text>
                  <Pressable
                    onPress={() => {
                      Clipboard.setString(trackingNumber!);
                      Alert.alert("คัดลอกแล้ว", trackingNumber!);
                    }}
                    className="flex-row items-center gap-1.5 rounded-xl bg-white px-3 py-2"
                    hitSlop={6}
                  >
                    <Copy size={14} color="#18181b" strokeWidth={2.2} />
                    <Text className="text-[12px] font-semibold text-fg">
                      คัดลอก
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => void Linking.openURL(courier.url)}
                  className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl bg-white py-2.5"
                >
                  <ExternalLink size={14} color="#18181b" strokeWidth={2.2} />
                  <Text className="text-[13px] font-semibold text-fg">
                    เช็คสถานะที่ {courier.name} →
                  </Text>
                </Pressable>
              </View>
            );
          })()}

          {/* Receipt thumbnail — stays with the order forever for review
              (911korn 2026-05-27 "มันควรคาอยู่ใน order นั้น แบบกดดูได้"). */}
          {receiptUrl ? (
            <Pressable
              onPress={() => void Linking.openURL(receiptUrl)}
              className="mt-4 overflow-hidden rounded-3xl border border-border bg-white"
            >
              <Image
                source={{ uri: receiptUrl }}
                style={{ width: "100%", height: 200 }}
                contentFit="contain"
              />
              <View className="flex-row items-center gap-2 border-t border-border bg-soft px-4 py-3">
                <Receipt size={14} color="#52525b" strokeWidth={2} />
                <Text className="text-[12px] font-medium text-muted">
                  ใบเสร็จขนส่งที่ AI scan · กดเพื่อดูเต็มจอ
                </Text>
              </View>
            </Pressable>
          ) : null}

          <Button
            className="mt-6"
            onPress={() => router.replace("/seller/orders")}
          >
            ทำออเดอร์ถัดไป →
          </Button>
          <Text className="mt-3 text-center text-[10px] text-muted">
            หรือรอ — ระบบจะพากลับหน้ารายการให้อัตโนมัติ
          </Text>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pt-6 pb-32">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          ส่งของให้ลูกค้า · ฟรี
        </Text>
        <Text className="mt-1 text-[20px] font-bold text-fg">
          พิมพ์ → drop ที่ courier → ถ่ายรูปใบเสร็จ
        </Text>
        <Text className="mt-1 text-[12px] leading-relaxed text-muted">
          ใช้ courier ไหนก็ได้ (Flash / Kerry / J&T / Thai Post) · จ่ายค่าส่ง
          เป็นเงินสดที่เคาน์เตอร์ · AI ดึงเลข tracking ให้อัตโนมัติ
        </Text>

        {/* Step 1: print label */}
        <StepCard step={1} title="พิมพ์ใบปะหน้า">
          <Text className="text-[12px] leading-relaxed text-muted">
            เปิดในเบราว์เซอร์ → กด "พิมพ์" → ตัด-ติดที่กล่อง
          </Text>
          <Button
            className="mt-3"
            variant="outline"
            onPress={() => {
              if (labelUrl) void Linking.openURL(labelUrl);
            }}
            disabled={!labelUrl}
          >
            <View className="flex-row items-center gap-2">
              <Printer size={16} color="#18181b" strokeWidth={2.2} />
              <Text className="text-[14px] font-semibold text-fg">
                เปิดใบปะหน้า
              </Text>
            </View>
          </Button>
          {order?.labelGeneratedAt ? (
            <Text className="mt-2 text-[10px] text-emerald-700">
              ✓ เปิดแล้วเมื่อ {new Date(order.labelGeneratedAt).toLocaleString()}
            </Text>
          ) : null}
        </StepCard>

        {/* Step 2: scan receipt */}
        <StepCard step={2} title="ถ่ายรูปใบเสร็จที่ courier ให้">
          <Text className="text-[12px] leading-relaxed text-muted">
            หลัง drop ที่เคาน์เตอร์ → courier ให้ใบเสร็จที่มีเลขพัสดุ →
            ถ่ายรูปให้เห็นชัด AI จะดึงเลขให้ทันที
          </Text>
          <Button
            className="mt-3"
            onPress={() => void takePhotoAndScan()}
            disabled={scanMutation.isPending}
          >
            {scanMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View className="flex-row items-center gap-2">
                <Camera size={16} color="#fff" strokeWidth={2.2} />
                <Text className="text-[14px] font-semibold text-white">
                  ถ่ายรูปใบเสร็จ
                </Text>
              </View>
            )}
          </Button>
        </StepCard>

        {pendingScan ? (
          <View className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <Text className="text-[13px] font-bold text-amber-900">
              ขอยืนยัน — ชื่อผู้รับไม่ตรง
            </Text>
            <Text className="mt-1 text-[12px] leading-relaxed text-amber-800">
              {pendingScan.message}
            </Text>
            <Text className="mt-3 text-[11px] text-zinc-500">
              tracking ที่ AI อ่าน:
            </Text>
            <Text className="font-mono text-[15px] font-bold text-zinc-900">
              {pendingScan.trackingNumber}
            </Text>
            <View className="mt-3 flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onPress={() => setPendingScan(null)}
              >
                ยกเลิก
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onPress={() =>
                  scanMutation.mutate({
                    dataBase64: pendingScan.dataBase64,
                    override: true,
                  })
                }
                disabled={scanMutation.isPending || !pendingScan.dataBase64}
              >
                ยืนยัน
              </Button>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-4 rounded-3xl border border-border bg-white p-5">
      <View className="flex-row items-center gap-3">
        <View className="size-7 items-center justify-center rounded-full bg-zinc-900">
          <Text className="text-[12px] font-bold text-white">{step}</Text>
        </View>
        <Text className="text-[15px] font-bold text-fg">{title}</Text>
      </View>
      <View className="mt-3">{children}</View>
    </View>
  );
}
