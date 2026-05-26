import { useMemo } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";
import { detectCourier } from "@/lib/courier-detect";

/**
 * /o/[token]/track?n=<tracking-number>
 *
 * In-app tracking screen — auto-detects the courier from the tracking
 * number format + loads their public tracking page in a WebView so the
 * buyer never leaves the SalePage app.
 *
 * Replaces the old `Linking.openURL(thailandpost.co.th/?...)` flow that
 * bounced to system Safari and only supported Thailand Post.
 */
export default function TrackScreen() {
  const { t } = useTranslation("order");
  const { n } = useLocalSearchParams<{ n?: string }>();
  const courier = useMemo(() => (n ? detectCourier(n) : null), [n]);

  if (!courier) {
    return (
      <View className="flex-1 items-center justify-center bg-soft px-6">
        <Text className="text-center text-[14px] text-muted">
          {t("tracking.noNumber", { defaultValue: "ไม่มีหมายเลขพัสดุ" })}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="border-b border-border bg-white px-4 py-2.5">
        <Text className="text-[11px] uppercase tracking-wider text-muted">
          {t("tracking.courier", { defaultValue: "ขนส่ง" })}
        </Text>
        <Text className="mt-0.5 text-[15px] font-semibold text-fg">
          {courier.name}
        </Text>
        <Text className="mt-0.5 font-mono text-[12px] text-muted">{n}</Text>
      </View>
      <WebView
        source={{ uri: courier.url }}
        startInLoadingState
        renderLoading={() => (
          <View className="flex-1 items-center justify-center bg-soft">
            <ActivityIndicator color="#e11d48" />
            <Text className="mt-2 text-[12px] text-muted">
              {t("tracking.loading", { defaultValue: "กำลังโหลด..." })}
            </Text>
          </View>
        )}
        // Allow inline media playback on courier pages that embed videos.
        allowsInlineMediaPlayback
        // Stop the webview from being able to open new windows (which on
        // some courier sites trigger native Safari).
        setSupportMultipleWindows={false}
      />
    </View>
  );
}
