import { useState } from "react";
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
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
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
 * /seller/products/new — owner-only mobile create-product flow.
 *
 * Flow:
 *   1. Tap "+" to add up to 5 images. Each is captured/picked, compressed
 *      with the shared image-compress helper (1600px JPEG q=0.82), and
 *      uploaded to `/api/v1/upload` via the base64 JSON path.
 *   2. Fill in name + price (THB) + optional description + stock.
 *   3. Submit → POST `/api/v1/shops/:slug/products` with the resulting
 *      Blob URLs. Server slugifies the name automatically.
 *
 * Uses our existing telemetry: image-upload failures hit Sentry as
 * `image_upload_failed`. Submit failures fall through ApiClientError's
 * human-readable Thai message — the form just shows it in an Alert.
 */

const MAX_IMAGES = 5;

interface UploadedImage {
  /** Local preview URI (for the thumbnail grid). */
  uri: string;
  /** Public Blob URL once `/api/v1/upload` returns. Empty while uploading. */
  url: string;
  status: "uploading" | "done" | "error";
}

export default function NewProductScreen() {
  const activeSlug = useSellerMode((s) => s.activeShopSlug);
  const queryClient = useQueryClient();

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceBaht, setPriceBaht] = useState("");
  const [stock, setStock] = useState("");
  const [type, setType] = useState<"PHYSICAL" | "DIGITAL">("PHYSICAL");
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [condition, setCondition] = useState<"NEW" | "PRE_OWNED">("NEW");
  const [digitalContent, setDigitalContent] = useState("");

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
      quality: 1, // We compress ourselves — let the picker hand us full quality.
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
          i === placeholderIdx
            ? { uri, url: res.url, status: "done" }
            : img,
        ),
      );
    } catch (err) {
      Sentry.captureException(err);
      setImages((prev) =>
        prev.map((img, i) =>
          i === placeholderIdx ? { ...img, status: "error" } : img,
        ),
      );
      const msg =
        err instanceof ApiClientError ? err.message : "อัปโหลดรูปไม่สำเร็จ";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  const uploadedUrls = images.filter((i) => i.status === "done").map((i) => i.url);
  const stillUploading = images.some((i) => i.status === "uploading");
  const priceBahtNum = Number(priceBaht.replace(/,/g, ""));
  const stockNum = stock.trim() ? Number(stock) : null;

  const digitalContentRequired =
    type === "DIGITAL" && digitalContent.trim().length < 2;
  const canSubmit =
    name.trim().length >= 2 &&
    Number.isInteger(priceBahtNum) &&
    priceBahtNum > 0 &&
    (stockNum === null || (Number.isInteger(stockNum) && stockNum >= 0)) &&
    uploadedUrls.length >= 1 &&
    !stillUploading &&
    !digitalContentRequired;

  const createMutation = useMutation({
    mutationFn: () => {
      if (!activeSlug) throw new Error("ไม่มีร้านที่ใช้งานอยู่");
      return api.shops.createProduct(activeSlug, {
        name: name.trim(),
        description: description.trim() || undefined,
        priceBaht: priceBahtNum,
        imageUrls: uploadedUrls,
        type,
        condition,
        category: category ?? undefined,
        digitalContent:
          type === "DIGITAL" ? digitalContent.trim() || null : null,
        ...(stockNum !== null ? { stock: stockNum } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shop", activeSlug] });
      Alert.alert("เพิ่มสินค้าเรียบร้อย", `${name.trim()} ขึ้นร้านแล้ว`, [
        { text: "ตกลง", onPress: () => router.replace("/seller/products") },
      ]);
    },
    onError: (err) => {
      Sentry.captureException(err);
      const msg =
        err instanceof ApiClientError ? err.message : "เพิ่มสินค้าไม่สำเร็จ";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  if (!activeSlug) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-fg">เลือกร้านก่อน</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* KeyboardAvoidingView pushes the sticky bottom CTA above the
          keyboard so seller can hit "เพิ่มสินค้า" without dismissing
          first (911korn 2026-05-27 "คีย์บอร์ดบัง บัง พิมพ์ลำบาก หน้า
          แอดสินค้า"). `padding` is the iOS-canonical behavior; Android
          ignores `behavior` and uses the system soft-input mode. */}
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
            เพิ่มสินค้าใหม่
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            ถ่ายรูป → ตั้งราคา → ขึ้นร้าน
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            อัปโหลดได้สูงสุด {MAX_IMAGES} รูป — ระบบบีบรูปอัตโนมัติให้เหลือ ~200 KB
            ก่อนส่งเข้า Vercel Blob ที่ Singapore
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
                <Text className="text-[24px]">📷</Text>
                <Text className="text-[10px] text-muted">ถ่าย</Text>
              </Pressable>
              <Pressable
                onPress={handlePickFromGallery}
                className="size-24 items-center justify-center rounded-2xl border border-dashed border-border bg-white"
              >
                <Text className="text-[24px]">🖼️</Text>
                <Text className="text-[10px] text-muted">เลือก</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Name */}
        <Section title="ชื่อสินค้า">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="เช่น เค้กชาไทย หน้าครีมสด"
            maxLength={120}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[15px] text-fg"
          />
        </Section>

        {/* Price + stock */}
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

        {/* Product type — Physical vs Digital. Default Physical; digital
            products skip shipping fields server-side. */}
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

        {/* Digital fulfillment — the content the buyer receives the
            moment slip-verify flips the order to PAID. Snapshotted on
            the order so future product edits don't affect past buyers
            (911korn 2026-05-27 "ผู้ขายต้องใส่รายละเอียดสิ่งที่ลูกค้าจะได้
            หลังจ่ายตังไปเลย"). Only mounted when type=DIGITAL. */}
        {type === "DIGITAL" ? (
          <Section title="เนื้อหาที่ลูกค้าจะได้รับหลังชำระเงิน">
            <View className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2">
              <Text className="text-[11px] leading-relaxed text-violet-900">
                ลูกค้าจะเห็นข้อความนี้ในอีเมล + หน้า Order ทันทีหลังสลิป
                ผ่าน · ใส่ ID/PW, license key, ลิงก์ดาวน์โหลด หรือคำสั่ง
                การใช้งานได้ · ข้อความจะถูก snapshot ตอนขาย แก้ทีหลังไม่
                กระทบลูกค้าที่ซื้อไปแล้ว
              </Text>
            </View>
            <TextInput
              value={digitalContent}
              onChangeText={setDigitalContent}
              placeholder="เช่น ID: example@mail.com / PW: 1234abcd / Server: Asia · หรือคำแนะนำการใช้งาน"
              multiline
              maxLength={5000}
              className="rounded-2xl border border-border bg-white px-3 py-2.5 font-mono text-[13px] text-fg"
              style={{ minHeight: 140, textAlignVertical: "top" }}
            />
            <Text className="text-right text-[10px] text-muted">
              {digitalContent.length}/5000
            </Text>
          </Section>
        ) : null}

        {/* Condition — New vs Pre-owned (มือสอง). Pre-owned surfaces a
            distinct badge on the marketplace + product detail. */}
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

        {/* Category — chip grid, single-select. Optional; falls back to
            shop category on listing surfaces if left blank. */}
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

        {/* Description */}
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

        {!canSubmit && images.length === 0 ? (
          <View className="mx-5 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
            <Text className="text-[12px] text-amber-900">
              ⚠️ ต้องอัปโหลดรูปอย่างน้อย 1 รูป
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky submit — sits INSIDE the KeyboardAvoidingView so the
          padding push lifts it above the keyboard rather than the older
          absolute-position trick that left it stranded behind. */}
      <View className="border-t border-border bg-white p-4 pb-6">
        <Button
          disabled={!canSubmit || createMutation.isPending}
          onPress={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : stillUploading ? (
            "กำลังอัปโหลดรูป..."
          ) : (
            "เพิ่มสินค้า"
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

/**
 * Toggle-style pill with icon + label + hint. Used for binary product
 * fields (type / condition) where the choice should feel concrete.
 * Pass `tone="rose"` to flip the active state from brand-pink to a
 * cooler emerald (used for "มือสอง" so the toggle reads as a "yes,
 * I'm aware" affirmation rather than a brand CTA).
 */
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
