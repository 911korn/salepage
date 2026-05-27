import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { safeBack } from "@/lib/safe-back";
import { Screen } from "@/components/ui/screen";
import { api } from "@/lib/api";
import { formatBaht } from "@/lib/format";

/**
 * /live/[id] — buyer-facing watch screen.
 *
 * V2.0 scaffolding: renders the cover image as a poster, a comments
 * overlay (poll every 3s), the pinned product card, and a comment
 * composer. Real video playback is gated on the RTC SDK integration —
 * for now we show "📺 ไลฟ์กำลังเตรียม video stream" so the rest of the
 * UX can be tested end-to-end.
 *
 * Heartbeat is fired every 30s while the screen is mounted; we stop
 * once the server returns `{ live: false }` (broadcast ended).
 */
const HEARTBEAT_MS = 30_000;
const COMMENT_POLL_MS = 3_000;

export default function LiveWatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [displayName, setDisplayName] = useState("");

  const detailQuery = useQuery({
    queryKey: ["live", id],
    queryFn: () => api.live.get(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000, // pinnedProductSlug + viewer count
  });

  // Heartbeat — fire every 30s while live. Stops on dismount or once the
  // server reports the broadcast has ended.
  const isLive = detailQuery.data?.broadcast.status === "LIVE";
  useEffect(() => {
    if (!id || !isLive) return;
    void api.live.heartbeat(id).catch(() => undefined);
    const handle = setInterval(() => {
      void api.live.heartbeat(id).catch(() => undefined);
    }, HEARTBEAT_MS);
    return () => clearInterval(handle);
  }, [id, isLive]);

  // Comments — incremental polling using `since` cursor.
  const [comments, setComments] = useState<
    Array<{ id: string; displayName: string; body: string; createdAt: string }>
  >([]);
  const sinceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function fetchTail() {
      try {
        const res = await api.live.listComments(id!, sinceRef.current ?? undefined);
        if (cancelled) return;
        if (res.comments.length > 0) {
          sinceRef.current = res.comments[res.comments.length - 1]!.id;
          setComments((prev) => [...prev, ...res.comments].slice(-100));
        }
      } catch {
        // poll errors are fine — we'll retry next tick
      }
    }
    void fetchTail();
    const handle = setInterval(fetchTail, COMMENT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [id]);

  const postMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("");
      return api.live.postComment(id, {
        body: draft.trim(),
        displayName: displayName.trim() || "ลูกค้า",
      });
    },
    onSuccess: (res) => {
      // Optimistically prepend so the user sees their comment instantly even
      // before the next poll cycle.
      setComments((prev) => [
        ...prev,
        {
          id: res.comment.id,
          displayName: res.comment.displayName,
          body: res.comment.body,
          createdAt: res.comment.createdAt,
        },
      ]);
      setDraft("");
      setComposerOpen(false);
    },
    onError: (e) => {
      Alert.alert(
        "ส่งคอมเม้นไม่สำเร็จ",
        e instanceof Error ? e.message : "ลองใหม่",
      );
    },
  });

  if (!id) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-fg">เกิดข้อผิดพลาด</Text>
        </View>
      </Screen>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!detailQuery.data) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">ไม่พบไลฟ์นี้</Text>
        <Pressable onPress={() => safeBack()} className="mt-4">
          <Text className="text-rose-400">ปิด</Text>
        </Pressable>
      </View>
    );
  }

  const { broadcast, pinnedProduct } = detailQuery.data;
  const ended =
    broadcast.status === "ENDED" || broadcast.status === "CANCELLED";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-black"
    >
      <StatusBar barStyle="light-content" />

      {/* Video / poster fallback */}
      <View className="flex-1">
        {broadcast.coverImageUrl ? (
          <Image
            source={{ uri: broadcast.coverImageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <View
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: broadcast.shop.themeColor }}
          >
            <Text className="text-[80px]">📺</Text>
          </View>
        )}

        {/* Top header */}
        <View className="absolute left-3 right-3 top-12 flex-row items-start gap-2">
          <Pressable
            onPress={() => router.push(`/s/${broadcast.shop.slug}`)}
            className="flex-row items-center gap-2 rounded-full bg-black/40 px-3 py-1.5"
          >
            <View className="size-2 rounded-full bg-rose-500" />
            <Text className="text-[12px] font-semibold text-white">
              {broadcast.shop.name}
            </Text>
          </Pressable>
          <View className="rounded-full bg-black/40 px-2.5 py-1">
            <Text className="text-[11px] text-white">
              👁 {broadcast.viewerCount.toLocaleString()}
            </Text>
          </View>
          <Pressable
            onPress={() => safeBack()}
            className="ml-auto size-9 items-center justify-center rounded-full bg-black/40"
          >
            <Text className="text-[18px] text-white">×</Text>
          </Pressable>
        </View>

        {/* Title */}
        <View className="absolute left-3 right-3 top-24">
          <Text
            className="text-[16px] font-bold text-white"
            numberOfLines={2}
          >
            {broadcast.title}
          </Text>
        </View>

        {ended ? (
          <View className="absolute inset-0 items-center justify-center bg-black/60 px-6">
            <Text className="text-[20px] font-bold text-white">
              ไลฟ์จบแล้ว
            </Text>
            <Text className="mt-2 text-center text-[12px] text-white/70">
              ผู้ชมรวม {broadcast.totalViews.toLocaleString()} ครั้ง
            </Text>
            <Pressable
              onPress={() => router.replace(`/s/${broadcast.shop.slug}`)}
              className="mt-4 rounded-full bg-white px-4 py-2"
            >
              <Text className="text-[12px] font-semibold text-black">
                ไปหน้าร้าน
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Comments overlay */}
            <View
              className="absolute bottom-32 left-0 right-0"
              style={{ maxHeight: 220 }}
              pointerEvents="none"
            >
              <ScrollView
                contentContainerClassName="px-3 pb-2 gap-1.5"
                showsVerticalScrollIndicator={false}
              >
                {comments.slice(-12).map((c) => (
                  <View
                    key={c.id}
                    className="self-start rounded-2xl bg-black/55 px-3 py-1.5"
                  >
                    <Text className="text-[11px] font-semibold text-amber-200">
                      {c.displayName}
                    </Text>
                    <Text className="text-[12px] text-white">{c.body}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Pinned product card */}
            {pinnedProduct ? (
              <Pressable
                onPress={() =>
                  router.push(
                    `/s/${broadcast.shop.slug}/${pinnedProduct.slug}`,
                  )
                }
                className="absolute bottom-20 left-3 right-3 flex-row items-center gap-3 rounded-2xl bg-white p-2 pr-3 shadow-lg"
              >
                <View className="size-14 overflow-hidden rounded-xl bg-soft">
                  {pinnedProduct.imageUrls?.[0] ? (
                    <Image
                      source={{ uri: pinnedProduct.imageUrls[0] }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  ) : null}
                </View>
                <View className="flex-1">
                  <Text
                    className="text-[12px] font-semibold text-fg"
                    numberOfLines={1}
                  >
                    📌 {pinnedProduct.name}
                  </Text>
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-[14px] font-bold text-rose-700">
                      {formatBaht(pinnedProduct.priceSatang)}
                    </Text>
                    {pinnedProduct.compareAtSatang &&
                    pinnedProduct.compareAtSatang >
                      pinnedProduct.priceSatang ? (
                      <Text className="text-[10px] text-muted line-through">
                        {formatBaht(pinnedProduct.compareAtSatang)}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View className="rounded-full bg-rose-600 px-3 py-1.5">
                  <Text className="text-[11px] font-semibold text-white">
                    ดูสินค้า →
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {/* Composer toggle / inline */}
            {composerOpen ? (
              <View className="absolute bottom-3 left-3 right-3 gap-2">
                {comments.length === 0 ? (
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="ชื่อแสดง (เช่น สมชาย)"
                    maxLength={30}
                    className="rounded-full bg-white px-4 py-2 text-[13px] text-fg"
                  />
                ) : null}
                <View className="flex-row gap-2">
                  <TextInput
                    autoFocus
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="พิมพ์ข้อความ..."
                    maxLength={280}
                    className="flex-1 rounded-full bg-white px-4 py-2 text-[13px] text-fg"
                  />
                  <Pressable
                    onPress={() => postMutation.mutate()}
                    disabled={
                      draft.trim().length === 0 || postMutation.isPending
                    }
                    className="items-center justify-center rounded-full bg-rose-600 px-4"
                  >
                    <Text className="text-[13px] font-semibold text-white">
                      ส่ง
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setComposerOpen(true)}
                className="absolute bottom-3 left-3 right-3 rounded-full bg-white/15 px-4 py-3"
              >
                <Text className="text-[13px] text-white">
                  💬 พิมพ์ข้อความ...
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
