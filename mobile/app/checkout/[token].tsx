import { useState, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { formatBaht, orderStatusLabel } from "@/lib/format";

type Mode = "qr-display" | "scan-slip" | "shoot-slip";

/**
 * Checkout / Pay screen — V0.5 core differentiator.
 *
 * Flow:
 *  1. Show shop's PromptPay QR (base64 PNG returned by POST /api/v1/orders).
 *  2. Customer pays in their bank app (Linking/external).
 *  3. Customer either:
 *     - Scans the QR printed on the slip (fastest, qrPayload mode)
 *     - Captures a photo of the slip
 *     - Picks an existing image from camera roll
 *  4. POST /api/v1/orders/:token/slip — get verify result.
 *  5. On success → push to /o/[token] for tracking.
 */
export default function CheckoutPayScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [mode, setMode] = useState<Mode>("qr-display");

  const orderQuery = useQuery({
    queryKey: ["order", token],
    queryFn: () => api.orders.get(token!),
    enabled: Boolean(token),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      // Stop polling once paid/cancelled
      return status && status !== "PENDING" ? false : 5_000;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (input:
      | { kind: "image"; uri: string; fileName: string; mimeType: string }
      | { kind: "qr"; payload: string }
    ) => {
      if (input.kind === "image") {
        return api.orders.verifySlip(token!, {
          uri: input.uri,
          name: input.fileName,
          type: input.mimeType,
        });
      }
      return api.orders.verifyQrPayload(token!, input.payload);
    },
    onSuccess: (res) => {
      if (res.verified) {
        Alert.alert("ยืนยันสลิปสำเร็จ", "ระบบได้รับการชำระเงินแล้ว", [
          { text: "ดูสถานะ", onPress: () => router.replace(`/o/${token}`) },
        ]);
      } else {
        Alert.alert(
          "ไม่ผ่านการตรวจสอบ",
          res.errorMessage ?? "กรุณาลองใหม่อีกครั้ง — ตรวจสอบจำนวนเงิน + ผู้รับ",
        );
      }
    },
    onError: (err) => {
      const msg =
        err instanceof ApiClientError ? err.message : "ตรวจสลิปล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  if (orderQuery.isLoading || !orderQuery.data) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }
  const order = orderQuery.data;

  // If paid already → go straight to tracking.
  if (order.status !== "PENDING") {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-fg">{orderStatusLabel(order.status)}</Text>
          <Button className="mt-4" onPress={() => router.replace(`/o/${token}`)}>
            ดูสถานะ
          </Button>
        </View>
      </Screen>
    );
  }

  if (mode === "scan-slip") {
    return (
      <SlipQrScanner
        onCancel={() => setMode("qr-display")}
        onScan={(payload) => verifyMutation.mutate({ kind: "qr", payload })}
        loading={verifyMutation.isPending}
      />
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-24">
        <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            ยอดที่ต้องชำระ
          </Text>
          <Text className="mt-1 text-[32px] font-bold text-brand-700">
            {formatBaht(order.totalSatang)}
          </Text>
          <Text className="mt-1 text-[12px] text-muted">
            ร้าน {order.shop.name}
          </Text>
          <CountdownTimer createdAt={order.createdAt} />
        </View>

        <View className="mx-5 mt-4 items-center rounded-3xl border border-border bg-white p-5">
          <Text className="text-[14px] font-semibold text-fg">
            สแกน QR PromptPay เพื่อชำระ
          </Text>
          <View className="mt-3 size-72 items-center justify-center overflow-hidden rounded-2xl bg-soft">
            {order.qr?.dataUrl ? (
              <Image
                source={{ uri: order.qr.dataUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            ) : (
              <Text className="px-4 text-center text-[12px] text-muted">
                ร้านนี้ยังไม่ได้ตั้ง PromptPay {"\n"}ติดต่อร้านโดยตรงเพื่อชำระ
              </Text>
            )}
          </View>
          <Text className="mt-3 text-center text-[12px] text-muted">
            หลังโอนแล้ว ส่งสลิปด้านล่างเพื่อยืนยันอัตโนมัติ
          </Text>
        </View>

        <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
          <Text className="text-[13px] font-semibold uppercase tracking-wider text-muted">
            ส่งสลิปยืนยัน
          </Text>
          <View className="mt-3 gap-2">
            <Button onPress={() => setMode("scan-slip")}>
              สแกน QR ของสลิป (เร็วที่สุด)
            </Button>
            <Button
              variant="outline"
              onPress={() => pickFromGallery(verifyMutation.mutate)}
            >
              เลือกรูปสลิปจากแกลเลอรี
            </Button>
          </View>
          {verifyMutation.isPending ? (
            <View className="mt-4 flex-row items-center gap-2">
              <ActivityIndicator color="#e11d48" />
              <Text className="text-[13px] text-muted">กำลังตรวจสลิป...</Text>
            </View>
          ) : null}
        </View>

        <View className="mx-5 mt-4 rounded-2xl border border-dashed border-border p-4">
          <Text className="text-[12px] text-muted">
            ระบบจะตรวจสลิปอัตโนมัติด้วย AI ภายใน 3–5 วินาที
            หากตรวจไม่ผ่าน ร้านจะรีวิวด้วยตัวเอง
          </Text>
        </View>

        {/* Cancel order — only available while PENDING (no slip submitted yet) */}
        <Pressable
          onPress={() => confirmCancelOrder(token!)}
          className="mx-5 mt-6 items-center py-2"
          hitSlop={8}
        >
          <Text className="text-[12px] text-rose-600 underline">
            ยกเลิกคำสั่งซื้อ
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

/**
 * 15-minute payment window countdown.
 *
 * We don't auto-cancel the order client-side — the backend's cron handles
 * expiry. This is a visual hint so the buyer knows their slot is finite,
 * which materially lifts conversion vs. an open-ended QR.
 */
function CountdownTimer({ createdAt }: { createdAt: string }) {
  const expiresAt = useMemo(
    () => new Date(createdAt).getTime() + 15 * 60 * 1000,
    [createdAt],
  );
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, expiresAt - Date.now()),
  );
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining(Math.max(0, expiresAt - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, remaining]);

  if (remaining <= 0) {
    return (
      <Text className="mt-2 text-[12px] text-rose-600">
        ⏱ หมดเวลาอย่างเป็นทางการ — สร้างคำสั่งไหม่หากยังต้องการจ่าย
      </Text>
    );
  }
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  const color = remaining < 60_000 ? "text-rose-600" : "text-amber-700";
  return (
    <Text className={`mt-2 text-[12px] font-semibold ${color}`}>
      ⏱ จ่ายภายใน {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}{" "}
      นาที
    </Text>
  );
}

function confirmCancelOrder(token: string) {
  Alert.alert(
    "ยกเลิกคำสั่งซื้อ?",
    "หากยกเลิก คุณจะไม่สามารถส่งสลิปอีกได้",
    [
      { text: "ไม่ยก", style: "cancel" },
      {
        text: "ยกเลิก",
        style: "destructive",
        onPress: async () => {
          try {
            await api.orders.cancel(token);
            Alert.alert("ยกเลิกแล้ว", "คำสั่งซื้อถูกยกเลิก", [
              { text: "ตกลง", onPress: () => router.replace("/") },
            ]);
          } catch (e) {
            const msg = e instanceof ApiClientError ? e.message : "ยกเลิกไม่สำเร็จ";
            Alert.alert("เกิดข้อผิดพลาด", msg);
          }
        },
      },
    ],
  );
}

async function pickFromGallery(
  submit: (input: {
    kind: "image";
    uri: string;
    fileName: string;
    mimeType: string;
  }) => void,
) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      "ต้องการสิทธิ์เข้าถึงคลังภาพ",
      "เปิดในการตั้งค่า > SalePage",
    );
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return;
  const asset = result.assets[0];
  submit({
    kind: "image",
    uri: asset.uri,
    fileName: asset.fileName ?? `slip-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
  });
}

function SlipQrScanner({
  onCancel,
  onScan,
  loading,
}: {
  onCancel: () => void;
  onScan: (payload: string) => void;
  loading: boolean;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  if (!permission) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-[15px] text-fg">
            ต้องการสิทธิ์ใช้กล้องเพื่อสแกน QR ของสลิป
          </Text>
          <Button className="mt-4" onPress={() => void requestPermission()}>
            อนุญาต
          </Button>
          <Pressable className="mt-3" onPress={onCancel}>
            <Text className="text-[13px] text-muted">ย้อนกลับ</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={(r: BarcodeScanningResult) => {
          if (scannedRef.current || loading) return;
          scannedRef.current = true;
          onScan(r.data);
        }}
      />
      <View className="absolute inset-x-0 bottom-10 px-6">
        <View className="rounded-2xl bg-black/70 p-4">
          <Text className="text-center text-[14px] text-white">
            จัดให้ QR บนสลิปอยู่กลางจอ
          </Text>
          <Pressable className="mt-3 self-center" onPress={onCancel}>
            <Text className="text-[13px] text-white/80 underline">ยกเลิก</Text>
          </Pressable>
        </View>
      </View>
      {loading ? (
        <View className="absolute inset-0 items-center justify-center bg-black/60">
          <ActivityIndicator color="#fff" size="large" />
          <Text className="mt-3 text-white">กำลังตรวจสลิป...</Text>
        </View>
      ) : null}
    </View>
  );
}

