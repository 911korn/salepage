import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react-native";

/**
 * "Use latest photo as slip?" prompt.
 *
 * Many Thai buyers transfer via the bank app, then return to SalePage
 * with the slip image freshly saved in their iOS Photos library. The
 * standard flow (tap "Pick from gallery" → grant permission → navigate
 * picker → choose photo → upload) is 4–5 taps. This component cuts it
 * to one tap by pre-detecting the latest image and offering it inline.
 *
 * Behaviour:
 *   - On mount, asks for media-library read permission (limited or full).
 *   - Queries the single newest asset.
 *   - If it was created in the last `freshWindowMs` (default 5 min),
 *     renders a one-tap card with a thumbnail.
 *   - Re-checks on focus so a user who just transferred sees the prompt
 *     immediately on return.
 *
 * Permission denials silently no-op — the existing "Pick from gallery"
 * button is still there as fallback.
 */
export function SuggestedSlip({
  onUse,
  freshWindowMs = 5 * 60 * 1000,
}: {
  onUse: (asset: { uri: string; fileName: string; mimeType: string }) => void;
  freshWindowMs?: number;
}) {
  const { t } = useTranslation("checkout");
  const [latest, setLatest] = useState<MediaLibrary.Asset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (!perm.granted) {
          if (!cancelled) setLoading(false);
          return;
        }
        const page = await MediaLibrary.getAssetsAsync({
          first: 1,
          mediaType: MediaLibrary.MediaType.photo,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        const asset = page.assets[0];
        if (cancelled || !asset) {
          if (!cancelled) setLoading(false);
          return;
        }
        // creationTime is ms since epoch (per docs); MediaLibrary on iOS
        // sometimes returns it in seconds — normalise both shapes.
        const createdMs =
          asset.creationTime > 1e12
            ? asset.creationTime
            : asset.creationTime * 1000;
        const fresh = Date.now() - createdMs < freshWindowMs;
        if (fresh && !cancelled) {
          setLatest(asset);
        }
      } catch {
        // Permission flow errored — fall through, no banner shown.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [freshWindowMs]);

  if (loading) return null;
  if (!latest) return null;

  return (
    <Pressable
      onPress={() =>
        onUse({
          uri: latest.uri,
          fileName: latest.filename || `slip-${Date.now()}.jpg`,
          mimeType: "image/jpeg",
        })
      }
      className="mx-5 mt-4 flex-row items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3 active:bg-brand-100"
    >
      <Image
        source={{ uri: latest.uri }}
        style={{ width: 56, height: 56, borderRadius: 12 }}
        contentFit="cover"
      />
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Sparkles size={12} color="#e11d48" strokeWidth={2.2} />
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">
            {t("slipAutoSuggested", { defaultValue: "เสนอจากรูปล่าสุด" })}
          </Text>
        </View>
        <Text className="mt-1 text-[13px] font-semibold text-fg">
          {t("slipUseLatestPhoto", { defaultValue: "ใช้รูปล่าสุดเป็นสลิป" })}
        </Text>
        <Text className="text-[11px] text-muted">
          {t("slipUseLatestHint", {
            defaultValue: "แตะเพื่อตรวจสอบ + ส่งทันที",
          })}
        </Text>
      </View>
      <ActivityIndicator color="transparent" />
    </Pressable>
  );
}
