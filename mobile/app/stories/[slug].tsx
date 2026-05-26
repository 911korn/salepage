import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { api } from "@/lib/api";

/**
 * /stories/[slug] — full-screen vertical story viewer.
 *
 * Auto-advances every 5s (image) — videos auto-advance when they end (V2.1).
 * Tap on the right half to skip forward, left half to go back. Swipe down
 * to dismiss (handled by the parent Stack's gesture-down behavior).
 *
 * We bump `viewCount` server-side on first-render of each story slide.
 */
const SLIDE_DURATION_MS = 5_000;

export default function StoryViewerScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const storiesQuery = useQuery({
    queryKey: ["stories", slug],
    queryFn: () => api.stories.forShop(slug!),
    enabled: Boolean(slug),
  });

  const stories = storiesQuery.data?.stories ?? [];
  const current = stories[index];

  // Reset progress during render whenever the visible slide id changes.
  // Doing it here (with a state guard) instead of inside the effect avoids
  // React 19's `set-state-in-effect` warning and prevents a flicker frame
  // where the previous slide's progress carries over to the new slide.
  const [lastSlideId, setLastSlideId] = useState<string | null>(null);
  if (current && lastSlideId !== current.id) {
    setLastSlideId(current.id);
    setProgress(0);
  }

  // Shared "go to next slide" — used by the auto-advance timer (images),
  // VideoSlide's onEnded callback (videos), and the right-tap handler.
  function advance() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (index < stories.length - 1) setIndex(index + 1);
    else router.back();
  }

  // Image slides: simple wall-clock progress. Video slides skip this loop —
  // VideoSlide drives its own progress + onEnded.
  useEffect(() => {
    if (!current || current.mediaKind !== "IMAGE") return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const startedAt = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(1, elapsed / SLIDE_DURATION_MS);
      setProgress(pct);
      if (pct >= 1) advance();
    }, 50);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.mediaKind, index, stories.length]);

  // View bump — fire-and-forget once per slide.
  useEffect(() => {
    if (!current || !slug) return;
    void api.stories.markViewed(slug, current.id).catch(() => undefined);
  }, [current?.id, slug]);

  if (!slug) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">เกิดข้อผิดพลาด</Text>
      </View>
    );
  }

  if (storiesQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (stories.length === 0 || !current) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">ไม่มีสตอรี่ในเวลานี้</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-rose-400">ปิด</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />

      {/* Story content */}
      {current.mediaKind === "IMAGE" ? (
        <Image
          source={{ uri: current.mediaUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
        />
      ) : (
        <VideoSlide uri={current.mediaUrl} onEnded={advance} />
      )}

      {/* Progress bars (one per slide) */}
      <View className="absolute left-3 right-3 top-12 flex-row gap-1">
        {stories.map((_, i) => (
          <View key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <View
              className="h-full bg-white"
              style={{
                width:
                  i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
              }}
            />
          </View>
        ))}
      </View>

      {/* Header */}
      <View className="absolute left-3 right-3 top-16 flex-row items-center gap-2">
        <Pressable
          onPress={() => router.push(`/s/${slug}`)}
          className="flex-row items-center gap-2"
        >
          <Text className="text-[12px] font-semibold text-white">
            @{slug}
          </Text>
          <Text className="text-[10px] text-white/70">
            {timeAgo(current.createdAt)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          className="ml-auto size-8 items-center justify-center"
        >
          <Text className="text-[18px] text-white">×</Text>
        </Pressable>
      </View>

      {/* Tap zones (left = back, right = next) */}
      <Pressable
        onPress={() => {
          if (index > 0) setIndex(index - 1);
        }}
        className="absolute left-0 top-0 h-full"
        style={{ width: "33%" }}
      />
      <Pressable
        onPress={() => {
          if (index < stories.length - 1) setIndex(index + 1);
          else router.back();
        }}
        className="absolute right-0 top-0 h-full"
        style={{ width: "67%" }}
      />

      {/* Caption + link CTA */}
      {current.caption || current.linkProductSlug || current.linkUrl ? (
        <View className="absolute bottom-10 left-3 right-3 rounded-2xl bg-black/60 p-4">
          {current.caption ? (
            <Text className="text-[14px] leading-relaxed text-white">
              {current.caption}
            </Text>
          ) : null}
          {current.linkProductSlug ? (
            <Pressable
              onPress={() =>
                router.push(`/s/${slug}/${current.linkProductSlug}`)
              }
              className="mt-2 self-start rounded-full bg-white px-3 py-1.5"
            >
              <Text className="text-[12px] font-semibold text-fg">
                ดูสินค้า →
              </Text>
            </Pressable>
          ) : current.linkUrl ? (
            <Pressable
              onPress={() => Linking.openURL(current.linkUrl!)}
              className="mt-2 self-start rounded-full bg-white px-3 py-1.5"
            >
              <Text className="text-[12px] font-semibold text-fg">
                เปิดลิงก์ ↗
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "เพิ่งโพสต์";
  if (mins < 60) return `${mins} นาที`;
  const hours = Math.floor(mins / 60);
  return `${hours} ชั่วโมง`;
}

/**
 * Video story slide. Owns its own VideoPlayer, auto-plays + auto-loops false
 * so we can fire onEnded once. Muted by default so the story rail doesn't
 * blast audio in someone's commute; users can tap the player to unmute (a
 * future polish). expo-video's `useVideoPlayer` cleans up the native player
 * when this component unmounts.
 */
function VideoSlide({
  uri,
  onEnded,
}: {
  uri: string;
  onEnded: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener("playToEnd", () => {
      onEnded();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit="contain"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
}
