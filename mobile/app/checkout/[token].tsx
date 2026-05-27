import { useState, useRef } from "react";
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
import { SuggestedSlip } from "@/components/suggested-slip";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import {
  CancelConfirmSheet,
  type CancelReason,
} from "@/components/cancel-confirm-sheet";
import { useTranslation } from "react-i18next";
import { i18n } from "@/lib/i18n";
import { api, ApiClientError } from "@/lib/api";
import { formatBaht, orderStatusLabel } from "@/lib/format";
import { compressForSlipUpload } from "@/lib/image-compress";

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
  const { t } = useTranslation(["checkout", "common"]);
  const { token } = useLocalSearchParams<{ token: string }>();
  const [mode, setMode] = useState<Mode>("qr-display");
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: (reason: CancelReason) =>
      api.orders.cancel(token!, { reason }),
    onSuccess: () => {
      setCancelSheetOpen(false);
      Alert.alert(t("cancelled"), t("cancelledBody"), [
        {
          text: t("common:actions.confirm"),
          onPress: () => router.replace("/"),
        },
      ]);
    },
    onError: (e) => {
      const msg =
        e instanceof ApiClientError ? e.message : t("cancelError");
      Alert.alert(t("verifyErrorTitle"), msg);
    },
  });

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
    mutationFn: async (input:
      | { kind: "image"; uri: string; fileName: string; mimeType: string }
      | { kind: "qr"; payload: string }
    ) => {
      if (input.kind === "image") {
        // Compress + base64 before POST. Compress runs on the JS thread but
        // expo-image-manipulator hands off to native — it's fast enough that
        // a fullscreen spinner is enough UX cover.
        const { base64 } = await compressForSlipUpload(input.uri);
        return api.orders.verifySlip(token!, base64);
      }
      return api.orders.verifyQrPayload(token!, input.payload);
    },
    onSuccess: (res) => {
      if (res.verified) {
        Alert.alert(t("verifySuccessTitle"), t("verifySuccessBody"), [
          { text: t("verifyShowStatus"), onPress: () => router.replace(`/o/${token}`) },
        ]);
        return;
      }
      // Free-tier shops don't have auto-verify — server stored the slip
      // and flipped the order into manual-review. Tell the buyer that
      // it's been received (not failed) so they don't keep retrying
      // (911korn 2026-05-27 "ร้านที่ไม่ได้ซื้อตรวจสลิป ควรผ่าน แต่
      // ขึ้นแจ้งลูกค้าทราบว่าร้านนี้ไม่ได้ใช้ระบบตรวจ Slip Auto").
      if (res.manualReview) {
        Alert.alert(
          "รับสลิปแล้ว · รอร้านตรวจสอบ",
          "ร้านนี้ไม่ได้ใช้ระบบตรวจสลิปอัตโนมัติ ระบบรับสลิปของคุณไว้แล้ว · กรุณาแจ้งเจ้าของร้านให้ตรวจสอบและยืนยันคำสั่งซื้อ อาจใช้เวลานานกว่าปกติ",
          [
            {
              text: "ดูสถานะออเดอร์",
              onPress: () => router.replace(`/o/${token}`),
            },
          ],
        );
        return;
      }
      Alert.alert(
        t("verifyFailTitle"),
        res.errorMessage ?? t("verifyFailBody"),
      );
    },
    onError: (err) => {
      const msg =
        err instanceof ApiClientError ? err.message : t("verifyErrorBody");
      Alert.alert(t("verifyErrorTitle"), msg);
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
            {t("verifyShowStatus")}
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
            {t("amountDue")}
          </Text>
          <Text className="mt-1 text-[32px] font-bold text-brand-700">
            {formatBaht(order.totalSatang)}
          </Text>
          <Text className="mt-1 text-[12px] text-muted">
            {t("shopRef", { name: order.shop.name })}
          </Text>
          {/* Calm reassurance instead of a pressure-pattern countdown
              (911korn 2026-05-27): the 7-day window lets a buyer who
              already paid but forgot to upload the slip come back later
              without losing their order. */}
          <Text className="mt-2 text-[12px] leading-relaxed text-muted">
            {t("uploadAnytime")}
          </Text>
        </View>

        <View className="mx-5 mt-4 items-center rounded-3xl border border-border bg-white p-5">
          <Text className="text-[14px] font-semibold text-fg">
            {t("scanPromptPay")}
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
                {t("noPromptPay")}
              </Text>
            )}
          </View>
          <Text className="mt-3 text-center text-[12px] text-muted">
            {t("afterTransfer")}
          </Text>
        </View>

        {/* Auto-suggest the latest photo if the buyer just snapped /
            received a slip via their bank app in the last 5 minutes —
            one-tap upload bypasses the gallery picker entirely. */}
        <SuggestedSlip
          onUse={(asset) =>
            verifyMutation.mutate({ kind: "image", ...asset })
          }
        />

        <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-5">
          <Text className="text-[13px] font-semibold uppercase tracking-wider text-muted">
            {t("uploadSlip")}
          </Text>
          <View className="mt-3 gap-2">
            <Button onPress={() => setMode("scan-slip")}>
              {t("scanSlipQr")}
            </Button>
            <Button
              variant="outline"
              onPress={() => pickFromGallery(verifyMutation.mutate)}
            >
              {t("pickFromGallery")}
            </Button>
          </View>
          {verifyMutation.isPending ? (
            <View className="mt-4 flex-row items-center gap-2">
              <ActivityIndicator color="#e11d48" />
              <Text className="text-[13px] text-muted">{t("verifying")}</Text>
            </View>
          ) : null}
        </View>

        <View className="mx-5 mt-4 rounded-2xl border border-dashed border-border p-4">
          <Text className="text-[12px] text-muted">
            {t("aiHint")}
          </Text>
        </View>

        {/* Cancel order — only available while PENDING (no slip submitted yet) */}
        <Pressable
          onPress={() => setCancelSheetOpen(true)}
          className="mx-5 mt-6 items-center py-2"
          hitSlop={8}
        >
          <Text className="text-[12px] text-rose-600 underline">
            {t("cancelOrder")}
          </Text>
        </Pressable>
      </ScrollView>

      <CancelConfirmSheet
        visible={cancelSheetOpen}
        pending={cancelMutation.isPending}
        onConfirm={(reason) => cancelMutation.mutate(reason)}
        onDismiss={() => setCancelSheetOpen(false)}
      />
    </Screen>
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
      i18n.t("checkout:galleryPermNeededTitle"),
      i18n.t("checkout:permSettingsHint"),
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
            {i18n.t("checkout:scannerCameraNeeded")}
          </Text>
          <Button className="mt-4" onPress={() => void requestPermission()}>
            {i18n.t("checkout:scannerAllow")}
          </Button>
          <Pressable className="mt-3" onPress={onCancel}>
            <Text className="text-[13px] text-muted">
              {i18n.t("checkout:scannerBack")}
            </Text>
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
            {i18n.t("checkout:scannerCenter")}
          </Text>
          <Pressable className="mt-3 self-center" onPress={onCancel}>
            <Text className="text-[13px] text-white/80 underline">
              {i18n.t("checkout:scannerCancel")}
            </Text>
          </Pressable>
        </View>
      </View>
      {loading ? (
        <View className="absolute inset-0 items-center justify-center bg-black/60">
          <ActivityIndicator color="#fff" size="large" />
          <Text className="mt-3 text-white">{i18n.t("checkout:verifying")}</Text>
        </View>
      ) : null}
    </View>
  );
}

