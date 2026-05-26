import { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  Dimensions,
  type ViewToken,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import AwesomeGallery from "react-native-awesome-gallery";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  /** Image URLs (cdn-ready). Order is preserved. */
  images: string[];
  /** Optional aspect ratio for the inline gallery. Default 1 (square). */
  aspectRatio?: number;
}

const { width: SCREEN_W } = Dimensions.get("window");

/**
 * ProductImageGallery — inline horizontal pager with paging dots, plus a
 * fullscreen pinch-zoom modal triggered on tap.
 *
 * Uses `expo-image` for caching + memory efficiency, and
 * `react-native-awesome-gallery` for the modal with pinch/pan/double-tap zoom.
 */
export function ProductImageGallery({ images, aspectRatio = 1 }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomStart, setZoomStart] = useState(0);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<string>>(null);

  if (images.length === 0) {
    return (
      <View
        style={{ aspectRatio, width: "100%" }}
        className="items-center justify-center bg-brand-50"
      >
        <Text className="text-[12px] text-muted">ไม่มีรูปภาพ</Text>
      </View>
    );
  }

  const onViewable = ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActiveIndex(first.index);
  };

  // Fallback for older RN: also track by scroll offset.
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setActiveIndex(idx);
  };

  return (
    <>
      <View style={{ aspectRatio, width: "100%" }} className="bg-brand-50">
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(uri, i) => `${i}-${uri}`}
          onMomentumScrollEnd={onMomentumEnd}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => {
                setZoomStart(index);
                setZoomOpen(true);
              }}
              style={{ width: SCREEN_W, aspectRatio }}
            >
              <Image
                source={{ uri: item }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          )}
        />

        {images.length > 1 ? (
          <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
            {images.map((_, i) => (
              <View
                key={i}
                className={
                  i === activeIndex
                    ? "h-1.5 w-4 rounded-full bg-white"
                    : "h-1.5 w-1.5 rounded-full bg-white/60"
                }
              />
            ))}
          </View>
        ) : null}

        {/* Index pill — bottom-right of the gallery so it doesn't collide
            with the floating cart pill we added at top-right of the
            product modal (911korn 2026-05-27 "UI ตระกร้าทับ กับ เลขจำนวน
            รูป ขยับลงมาหน่อย"). */}
        <View className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1">
          <Text className="text-[11px] font-medium text-white">
            {activeIndex + 1}/{images.length}
          </Text>
        </View>
      </View>

      {/* Pinch-to-zoom fullscreen modal */}
      <Modal
        visible={zoomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomOpen(false)}
        statusBarTranslucent
      >
        <View className="flex-1 bg-black">
          <AwesomeGallery
            data={images}
            initialIndex={zoomStart}
            keyExtractor={(uri, i) => `${i}-${uri}`}
            onSwipeToClose={() => setZoomOpen(false)}
            onTap={() => setZoomOpen(false)}
            doubleTapInterval={250}
          />
          <Pressable
            onPress={() => setZoomOpen(false)}
            style={{ top: insets.top + 8 }}
            className="absolute right-4 size-9 items-center justify-center rounded-full bg-white/15"
          >
            <Text className="text-[16px] text-white">×</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
