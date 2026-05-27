import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Printer, Camera, CheckCircle2 } from "lucide-react-native";
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
  } | null>(null);
  const [scannedNow, setScannedNow] = useState<{
    trackingNumber: string;
    courier: string | null;
  } | null>(null);

  const labelUrl = token
    ? `${apiBaseUrl.replace(/\/$/, "")}/api/v1/orders/${token}/shipment/label`
    : null;

  const scanMutation = useMutation({
    mutationFn: async (override: boolean) => {
      if (!token) throw new Error("missing token");
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("ต้องการสิทธิ์ใช้กล้อง", "เปิดในการตั้งค่า > SalePage");
        throw new Error("camera_perm_denied");
      }
      const shot = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (shot.canceled || !shot.assets[0]) throw new Error("cancelled");
      const { base64 } = await compressForSlipUpload(shot.assets[0].uri);
      return api.orders.scanShippingReceipt(token, {
        dataBase64: base64,
        contentType: "image/jpeg",
        confirmOverride: override,
      });
    },
    onSuccess: (res) => {
      if (res.ok) {
        setScannedNow({
          trackingNumber: res.trackingNumber,
          courier: res.courier,
        });
        setPendingScan(null);
        void orderQuery.refetch();
        return;
      }
      if (res.reason === "name_mismatch" && res.scan.trackingNumber) {
        setPendingScan({
          receiverName: res.scan.receiverName,
          trackingNumber: res.scan.trackingNumber,
          receiptUrl: res.receiptUrl,
          message: res.message,
        });
        return;
      }
      Alert.alert("AI อ่านใบเสร็จไม่สำเร็จ", res.message);
    },
    onError: (err) => {
      if (err instanceof Error && err.message === "cancelled") return;
      if (err instanceof Error && err.message === "camera_perm_denied") return;
      Sentry.captureException(err);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof ApiClientError ? err.message : "ลองอีกครั้ง",
      );
    },
  });

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
    return (
      <Screen>
        <ScrollView contentContainerClassName="px-5 pt-6 pb-32">
          <View className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <View className="flex-row items-center gap-2">
              <CheckCircle2 size={22} color="#047857" strokeWidth={2.2} />
              <Text className="text-[16px] font-bold text-emerald-900">
                ส่งของแล้ว · AI ดึงเลข tracking ให้แล้ว
              </Text>
            </View>
            <Text className="mt-3 font-mono text-[18px] font-bold text-emerald-900">
              {trackingNumber}
            </Text>
            <Text className="mt-2 text-[11px] leading-relaxed text-emerald-700">
              ลูกค้าได้รับอีเมล + LINE แจ้งเลขพัสดุแล้ว · พวกเขาเอา
              tracking ไปเช็คที่หน้า courier ได้เลย
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
            onPress={() => scanMutation.mutate(false)}
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
                onPress={() => scanMutation.mutate(true)}
                disabled={scanMutation.isPending}
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
