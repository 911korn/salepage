import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Trash2, Camera, ImagePlus } from "lucide-react-native";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { compressForSlipUpload } from "@/lib/image-compress";
import { useSellerMode } from "@/store/seller-mode";
import { Sentry } from "@/lib/sentry";
import {
  PRODUCT_CATEGORIES,
  type CategoryKey,
} from "@/lib/product-categories";
import { Package, Download, Sparkles, Recycle } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

/**
 * /seller/products/[productSlug]/edit — in-app edit for an existing
 * product. 911korn 2026-05-27: "ไม่เอา Edit on Web ต้องการให้ Add
 * Product Edit Product จัดการทุกอย่างได้ผ่าน App ทั้งหมดเลย".
 *
 * Flow:
 *   - Prefill form from api.shop.get's products[] (we route here from the
 *     seller products list, so the product row already exists in the
 *     cached shop query).
 *   - Image grid: keep existing (their URLs are already on Vercel Blob),
 *     add new ones via picker → compress → upload → URL appended.
 *   - Save → PATCH /api/v1/shops/:slug/products/:productSlug
 *   - Delete → DELETE same endpoint, then router.replace back.
 *
 * Shares image-pick / compress / upload code shape with the new-product
 * screen, kept inline for now — duplication is small enough that a
 * shared form component would cost more than it saves.
 */

const MAX_IMAGES = 5;

interface UploadedImage {
  /** Local preview OR remote URL. */
  uri: string;
  /** Public Blob URL once `/api/v1/upload` returns (or initial URL for existing). */
  url: string;
  status: "uploading" | "done" | "error";
}

export default function EditProductScreen() {
  const { productSlug } = useLocalSearchParams<{ productSlug: string }>();
  const activeSlug = useSellerMode((s) => s.activeShopSlug);
  const queryClient = useQueryClient();

  const shopQuery = useQuery({
    queryKey: ["shop", activeSlug],
    queryFn: () => api.shop.get(activeSlug!),
    enabled: Boolean(activeSlug),
  });
  const product = shopQuery.data?.products.find((p) => p.slug === productSlug);

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceBaht, setPriceBaht] = useState("");
  const [stock, setStock] = useState("");
  const [type, setType] = useState<"PHYSICAL" | "DIGITAL">("PHYSICAL");
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [condition, setCondition] = useState<"NEW" | "PRE_OWNED">("NEW");
  const [initialized, setInitialized] = useState(false);

  // Prefill once the product row arrives from the cache/network.
  useEffect(() => {
    if (initialized || !product) return;
    setName(product.name);
    setDescription(product.description ?? "");
    setPriceBaht(String(Math.round(product.priceSatang / 100)));
    setStock(product.stock === null ? "" : String(product.stock));
    setType(product.type);
    setCategory(
      product.category && PRODUCT_CATEGORIES.some((c) => c.key === product.category)
        ? (product.category as CategoryKey)
        : null,
    );
    setCondition(product.condition);
    setImages(
      (product.imageUrls ?? []).map((url) => ({
        uri: url,
        url,
        status: "done" as const,
      })),
    );
    setInitialized(true);
  }, [product, initialized]);

  async function handlePickFromGallery() {
    if (images.length >= MAX_IMAGES) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("ต้องการสิทธิ์เข้าถึงคลังภาพ", "เปิดในการตั้งค่า > SalePage");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      selectionLimit: MAX_IMAGES - images.length,
      allowsMultipleSelection: true,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      void uploadOne(asset.uri);
    }
  }

  async function handleCameraShot() {
    if (images.length >= MAX_IMAGES) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("ต้องการสิทธิ์ใช้กล้อง", "เปิดในการตั้งค่า > SalePage");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    void uploadOne(result.assets[0].uri);
  }

  async function uploadOne(uri: string) {
    const placeholderIdx = images.length;
    setImages((prev) => [...prev, { uri, url: "", status: "uploading" }]);
    try {
      const { base64 } = await compressForSlipUpload(uri);
      const res = await api.upload.fromBase64({
        filename: `product-${Date.now()}.jpg`,
        contentType: "image/jpeg",
        dataBase64: base64,
      });
      setImages((prev) =>
        prev.map((img, i) =>
          i === placeholderIdx ? { uri, url: res.url, status: "done" } : img,
        ),
      );
    } catch (err) {
      Sentry.captureException(err);
      setImages((prev) =>
        prev.map((img, i) =>
          i === placeholderIdx ? { ...img, status: "error" } : img,
        ),
      );
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof ApiClientError ? err.message : "อัปโหลดรูปไม่สำเร็จ",
      );
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  const uploadedUrls = images.filter((i) => i.status === "done").map((i) => i.url);
  const stillUploading = images.some((i) => i.status === "uploading");
  const priceBahtNum = Number(priceBaht.replace(/,/g, ""));
  const stockNum = stock.trim() ? Number(stock) : null;

  const canSubmit =
    initialized &&
    name.trim().length >= 2 &&
    Number.isInteger(priceBahtNum) &&
    priceBahtNum > 0 &&
    (stockNum === null || (Number.isInteger(stockNum) && stockNum >= 0)) &&
    uploadedUrls.length >= 1 &&
    !stillUploading;

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!activeSlug || !productSlug) throw new Error("missing slug");
      return api.shops.updateProduct(activeSlug, productSlug, {
        name: name.trim(),
        description: description.trim() || null,
        priceBaht: priceBahtNum,
        imageUrls: uploadedUrls,
        type,
        category: category ?? null,
        condition,
        stock: stockNum,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shop", activeSlug] });
      Alert.alert("บันทึกแล้ว", `${name.trim()} อัปเดตเรียบร้อย`, [
        { text: "ตกลง", onPress: () => router.replace("/seller/products") },
      ]);
    },
    onError: (err) => {
      Sentry.captureException(err);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof ApiClientError ? err.message : "บันทึกไม่สำเร็จ",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!activeSlug || !productSlug) throw new Error("missing slug");
      return api.shops.deleteProduct(activeSlug, productSlug);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shop", activeSlug] });
      router.replace("/seller/products");
    },
    onError: (err) => {
      Sentry.captureException(err);
      Alert.alert(
        "ลบไม่สำเร็จ",
        err instanceof ApiClientError ? err.message : "ลองใหม่อีกครั้ง",
      );
    },
  });

  if (!activeSlug || !productSlug) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-fg">ไม่พบสินค้า</Text>
        </View>
      </Screen>
    );
  }
  if (shopQuery.isLoading || !initialized) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }
  if (!product) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-fg">สินค้านี้ถูกลบไปแล้ว</Text>
          <Button
            className="mt-4"
            variant="outline"
            onPress={() => router.replace("/seller/products")}
          >
            กลับไปหน้าสินค้า
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
      <ScrollView
        contentContainerClassName="pb-40"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            แก้ไขสินค้า
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">{product.name}</Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            อัปเดตข้อมูล + รูปสินค้าได้ในแอป ระบบบีบรูปอัตโนมัติก่อนส่ง
          </Text>
        </View>

        {/* Image grid */}
        <View className="mx-5 mt-4 flex-row flex-wrap gap-2">
          {images.map((img, i) => (
            <View key={`${img.uri}-${i}`} className="relative">
              <View className="size-24 overflow-hidden rounded-2xl border border-border bg-soft">
                <Image
                  source={{ uri: img.uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
                {img.status === "uploading" ? (
                  <View className="absolute inset-0 items-center justify-center bg-black/40">
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
                {img.status === "error" ? (
                  <View className="absolute inset-0 items-center justify-center bg-rose-600/70">
                    <Text className="text-[12px] font-bold text-white">!</Text>
                  </View>
                ) : null}
              </View>
              <Pressable
                onPress={() => removeImage(i)}
                hitSlop={8}
                className="absolute -right-1.5 -top-1.5 size-6 items-center justify-center rounded-full bg-rose-600"
              >
                <Text className="text-[12px] font-bold text-white">×</Text>
              </Pressable>
            </View>
          ))}
          {images.length < MAX_IMAGES ? (
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleCameraShot}
                className="size-24 items-center justify-center rounded-2xl border border-dashed border-border bg-white"
              >
                <Camera size={22} color="#737373" strokeWidth={1.8} />
                <Text className="mt-1 text-[10px] text-muted">ถ่าย</Text>
              </Pressable>
              <Pressable
                onPress={handlePickFromGallery}
                className="size-24 items-center justify-center rounded-2xl border border-dashed border-border bg-white"
              >
                <ImagePlus size={22} color="#737373" strokeWidth={1.8} />
                <Text className="mt-1 text-[10px] text-muted">เลือก</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Section title="ชื่อสินค้า">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="เช่น เค้กชาไทย หน้าครีมสด"
            maxLength={120}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[15px] text-fg"
          />
        </Section>

        <Section title="ราคา + สต๊อก">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-[11px] text-muted">ราคา (฿)</Text>
              <TextInput
                value={priceBaht}
                onChangeText={(v) => setPriceBaht(v.replace(/[^\d]/g, ""))}
                keyboardType="number-pad"
                maxLength={8}
                placeholder="เช่น 250"
                className="mt-1 rounded-2xl border border-border bg-white px-3 py-2.5 text-[15px] font-semibold text-fg"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[11px] text-muted">
                สต๊อก (ปล่อยว่าง = ไม่จำกัด)
              </Text>
              <TextInput
                value={stock}
                onChangeText={(v) => setStock(v.replace(/[^\d]/g, ""))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="ไม่จำกัด"
                className="mt-1 rounded-2xl border border-border bg-white px-3 py-2.5 text-[15px] font-semibold text-fg"
              />
            </View>
          </View>
        </Section>

        <Section title="ประเภทสินค้า">
          <View className="flex-row gap-2">
            <TogglePill
              active={type === "PHYSICAL"}
              onPress={() => setType("PHYSICAL")}
              Icon={Package}
              label="จัดส่งจริง"
              hint="สินค้าที่ต้องส่งของ"
            />
            <TogglePill
              active={type === "DIGITAL"}
              onPress={() => setType("DIGITAL")}
              Icon={Download}
              label="ดิจิทัล"
              hint="ไฟล์ / โค้ด / บริการ"
              tone="violet"
            />
          </View>
        </Section>

        <Section title="สภาพสินค้า">
          <View className="flex-row gap-2">
            <TogglePill
              active={condition === "NEW"}
              onPress={() => setCondition("NEW")}
              Icon={Sparkles}
              label="ของใหม่"
              hint="ป้ายห้อย ยังไม่เคยใช้"
              tone="emerald"
            />
            <TogglePill
              active={condition === "PRE_OWNED"}
              onPress={() => setCondition("PRE_OWNED")}
              Icon={Recycle}
              label="มือสอง"
              hint="ใช้แล้ว / สภาพดี"
              tone="amber"
            />
          </View>
        </Section>

        <Section title="หมวดหมู่ (ไม่จำเป็น)">
          <View className="flex-row flex-wrap gap-2">
            {PRODUCT_CATEGORIES.map((c) => {
              const isActive = category === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setCategory(isActive ? null : c.key)}
                  className={`rounded-full border px-3 py-1.5 ${
                    isActive
                      ? "border-brand-300 bg-brand-50"
                      : "border-border bg-white"
                  }`}
                >
                  <Text
                    className={`text-[12px] ${
                      isActive ? "font-semibold text-brand-700" : "text-fg"
                    }`}
                  >
                    {c.labelTh}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="คำอธิบาย (ไม่จำเป็น)">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="รายละเอียดสินค้า · วัสดุ · ขนาด · เงื่อนไขรับประกัน ฯลฯ"
            multiline
            maxLength={2000}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[14px] text-fg"
            style={{ minHeight: 100, textAlignVertical: "top" }}
          />
          <Text className="text-right text-[10px] text-muted">
            {description.length}/2000
          </Text>
        </Section>

        <View className="mx-5 mt-8">
          <Pressable
            onPress={() => {
              Alert.alert("ลบสินค้านี้?", "การลบไม่สามารถกู้คืนได้", [
                { text: "ยกเลิก", style: "cancel" },
                {
                  text: "ลบ",
                  style: "destructive",
                  onPress: () => deleteMutation.mutate(),
                },
              ]);
            }}
            disabled={deleteMutation.isPending}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 active:bg-rose-50"
          >
            <Trash2 size={16} color="#e11d48" strokeWidth={2} />
            <Text className="text-[14px] font-semibold text-brand-700">
              ลบสินค้า
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View className="border-t border-border bg-white p-4 pb-6">
        <Button
          disabled={!canSubmit || updateMutation.isPending}
          onPress={() => updateMutation.mutate()}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : stillUploading ? (
            "กำลังอัปโหลดรูป..."
          ) : (
            "บันทึก"
          )}
        </Button>
      </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mx-5 mt-5 gap-2">
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </Text>
      {children}
    </View>
  );
}

function TogglePill({
  active,
  onPress,
  Icon,
  label,
  hint,
  tone = "brand",
}: {
  active: boolean;
  onPress: () => void;
  Icon: LucideIcon;
  label: string;
  hint: string;
  tone?: "brand" | "emerald" | "amber" | "violet";
}) {
  const palette =
    tone === "violet"
      ? { border: "border-violet-300", bg: "bg-violet-50", text: "text-violet-700", icon: "#7c3aed" }
      : tone === "amber"
        ? { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-800", icon: "#d97706" }
        : tone === "emerald"
          ? { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700", icon: "#059669" }
          : { border: "border-brand-300", bg: "bg-brand-50", text: "text-brand-700", icon: "#e11d48" };
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-2xl border px-3 py-3 ${
        active ? `${palette.border} ${palette.bg}` : "border-border bg-white"
      }`}
    >
      <Icon size={22} color={active ? palette.icon : "#52525b"} strokeWidth={2.2} />
      <Text
        className={`mt-1.5 text-[14px] font-semibold ${
          active ? palette.text : "text-fg"
        }`}
      >
        {label}
      </Text>
      <Text className="text-[11px] text-muted">{hint}</Text>
    </Pressable>
  );
}
