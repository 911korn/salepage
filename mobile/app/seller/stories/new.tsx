import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { useSellerMode } from "@/store/seller-mode";

/**
 * /seller/stories/new — owner posts a new 24h story.
 *
 * Flow:
 *   1. Pick image (we cap at IMAGE for V2.0; video lands in V2.1).
 *   2. Optional caption (≤ 280 chars).
 *   3. Optional CTA — choose a product from the shop catalog OR an external URL.
 *   4. Submit → POST `/api/v1/shops/:slug/stories` → bounce back to the list.
 *
 * Caption + link both optional. The story is still useful as pure visual
 * (e.g. "ของใหม่ไหม่!" — caption only adds context).
 */
export default function NewStoryScreen() {
  const queryClient = useQueryClient();
  const activeSlug = useSellerMode((s) => s.activeShopSlug);

  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [imageRemoteUrl, setImageRemoteUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [linkProductSlug, setLinkProductSlug] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Products list — used for the product-link picker. We piggy-back on
  // `api.shop.get(slug)` since the public shop GET already returns the
  // catalog with imageUrls, slugs, and prices — no need for a seller-only
  // products endpoint.
  const productsQuery = useQuery({
    queryKey: ["shop", activeSlug],
    queryFn: () => api.shop.get(activeSlug!),
    enabled: Boolean(activeSlug),
  });
  const products = productsQuery.data?.products ?? [];

  const createMutation = useMutation({
    mutationFn: () => {
      if (!imageRemoteUrl) throw new Error("กรุณาเลือกรูปก่อน");
      return api.stories.create(activeSlug!, {
        mediaUrl: imageRemoteUrl,
        mediaKind: "IMAGE",
        caption: caption.trim() || undefined,
        linkProductSlug: linkProductSlug ?? undefined,
      });
    },
    onSuccess: () => {
      // Invalidate both the seller list AND the public rail so the new
      // story appears instantly to viewers (e.g. while the seller is
      // demo-ing it on a second device).
      void queryClient.invalidateQueries({
        queryKey: ["seller", "stories", activeSlug],
      });
      void queryClient.invalidateQueries({ queryKey: ["stories"] });
      void queryClient.invalidateQueries({
        queryKey: ["stories", activeSlug],
      });
      router.replace("/seller/stories");
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "ส่งล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  async function pickAndUpload() {
    if (uploading) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // Stories are tall — 9:16 — so we let the user crop. Skipping cropping
      // means stories rendered in `contain` mode get letterboxed, but at
      // least nothing is lost.
      quality: 0.85,
      allowsEditing: true,
      aspect: [9, 16],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageLocalUri(asset.uri);
    setUploading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
      const contentType =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const uploaded = await api.upload.fromBase64({
        filename: `story-${Date.now()}.${ext}`,
        contentType,
        dataBase64: base64,
      });
      setImageRemoteUrl(uploaded.url);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "อัปโหลดล้มเหลว";
      Alert.alert("อัปโหลดล้มเหลว", msg);
      setImageLocalUri(null);
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = Boolean(imageRemoteUrl) && !createMutation.isPending;

  if (!activeSlug) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-fg">เกิดข้อผิดพลาด</Text>
        </View>
      </Screen>
    );
  }

  const selectedProduct = products.find((p) => p.slug === linkProductSlug);

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            โพสต์สตอรี่ใหม่
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            จะโชว์ 24 ชั่วโมง
          </Text>
        </View>

        {/* Image picker */}
        <View className="mx-5 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            รูปภาพ (จำเป็น)
          </Text>
          <Pressable
            onPress={pickAndUpload}
            disabled={uploading}
            className="mt-2 aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-border bg-soft"
            style={{ maxHeight: 480 }}
          >
            {uploading ? (
              <View className="items-center gap-2">
                <ActivityIndicator color="#e11d48" />
                <Text className="text-[11px] text-muted">กำลังอัปโหลด...</Text>
              </View>
            ) : imageLocalUri ? (
              <Image
                source={{ uri: imageLocalUri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <View className="items-center gap-1">
                <Text className="text-[40px]">📸</Text>
                <Text className="text-[12px] font-semibold text-fg">
                  แตะเพื่อเลือกรูป
                </Text>
                <Text className="text-[10px] text-muted">
                  สัดส่วน 9:16 (แนวตั้ง)
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Caption */}
        <View className="mx-5 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            คำบรรยาย (ไม่จำเป็น)
          </Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="โปรพิเศษ! ลด 30% เฉพาะวันนี้..."
            multiline
            maxLength={280}
            className="mt-2 rounded-2xl border border-border bg-white px-3 py-2.5 text-[14px] text-fg"
            style={{ minHeight: 70, textAlignVertical: "top" }}
          />
          <Text className="text-right text-[10px] text-muted">
            {caption.length}/280
          </Text>
        </View>

        {/* Product link picker */}
        <View className="mx-5 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            ลิงก์สินค้า (ไม่จำเป็น)
          </Text>
          {selectedProduct ? (
            <View className="mt-2 flex-row items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3">
              <View className="size-12 overflow-hidden rounded-lg bg-soft">
                {selectedProduct.imageUrls?.[0] ? (
                  <Image
                    source={{ uri: selectedProduct.imageUrls[0] }}
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
                  {selectedProduct.name}
                </Text>
                <Text className="text-[10px] text-muted">
                  {(selectedProduct.priceSatang / 100).toLocaleString()} ฿
                </Text>
              </View>
              <Pressable
                onPress={() => setLinkProductSlug(null)}
                className="size-7 items-center justify-center rounded-full bg-white"
              >
                <Text className="text-[14px] text-muted">×</Text>
              </Pressable>
            </View>
          ) : null}
          {!selectedProduct && products.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="mt-2 gap-2"
            >
              {products.slice(0, 20).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setLinkProductSlug(p.slug)}
                  className="w-32 overflow-hidden rounded-xl border border-border bg-white"
                >
                  <View className="aspect-square w-full bg-soft">
                    {p.imageUrls?.[0] ? (
                      <Image
                        source={{ uri: p.imageUrls[0] }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : null}
                  </View>
                  <View className="p-2">
                    <Text
                      className="text-[11px] font-semibold text-fg"
                      numberOfLines={2}
                    >
                      {p.name}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {!productsQuery.data && productsQuery.isLoading ? (
            <View className="mt-2 py-4">
              <ActivityIndicator color="#e11d48" />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky submit */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white p-4">
        <Button
          disabled={!canSubmit}
          onPress={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "กำลังโพสต์..." : "โพสต์สตอรี่"}
        </Button>
      </View>
    </Screen>
  );
}
