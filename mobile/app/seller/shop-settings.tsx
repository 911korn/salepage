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
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { compressForSlipUpload } from "@/lib/image-compress";
import { ShopCover, ShopCoverFallback } from "@/components/shop-cover";
import { useSellerMode } from "@/store/seller-mode";
import { Sentry } from "@/lib/sentry";

/**
 * /seller/shop-settings — owner-only shop profile editor.
 *
 * Lets the merchant upload up to 3 banner images + a logo, set theme color,
 * tweak shop name + description + announcement + LINE/phone contacts.
 *
 * The home feed renders shop cards with a solid `themeColor` block when
 * `bannerUrls` is empty — 911korn's feedback was that this looks unprofessional,
 * so this screen is the path to fix it.
 *
 * All uploads go through `/api/v1/upload` (base64 JSON) via the existing
 * `compressForSlipUpload` helper (1600px JPEG q=0.82). Saves use a single
 * PATCH `/api/v1/shops/:slug` round-trip so partial-failure stays atomic.
 */

const MAX_BANNERS = 3;

const THEME_PRESETS = [
  "#e11d48", // brand rose-600
  "#f97316", // orange-500
  "#eab308", // yellow-500
  "#22c55e", // green-500
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#0f172a", // slate-900
];

interface UploadSlot {
  url: string;
  status: "uploading" | "done" | "error";
  localUri?: string;
}

export default function ShopSettingsScreen() {
  const activeSlug = useSellerMode((s) => s.activeShopSlug);
  const queryClient = useQueryClient();

  const shopQuery = useQuery({
    queryKey: ["shop", activeSlug],
    queryFn: () => api.shop.get(activeSlug!),
    enabled: Boolean(activeSlug),
  });
  const shop = shopQuery.data?.shop;

  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [lineContact, setLineContact] = useState<string | null>(null);
  const [banners, setBanners] = useState<UploadSlot[] | null>(null);
  const [logo, setLogo] = useState<UploadSlot | null | "cleared">(null);

  // Seed local state from server shop once on first load, then leave alone so
  // the user's edits aren't clobbered by a refetch. The state-guard pattern
  // mirrors the cart screen.
  const [lastSeededSlug, setLastSeededSlug] = useState<string | null>(null);
  if (shop && lastSeededSlug !== shop.slug) {
    setLastSeededSlug(shop.slug);
    setName(shop.name);
    setDescription(shop.description ?? "");
    setThemeColor(shop.themeColor);
    setAnnouncement(shop.announcement ?? "");
    const contact = shop.contact ?? {};
    setPhone(contact.phone ?? "");
    setLineContact(contact.line ?? "");
    setBanners(shop.bannerUrls.map((url) => ({ url, status: "done" })));
    setLogo(shop.logoUrl ? { url: shop.logoUrl, status: "done" } : null);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!activeSlug || !shop) throw new Error("ไม่มีร้านที่ใช้งานอยู่");
      const stillUploading =
        banners?.some((b) => b.status === "uploading") ||
        (logo !== "cleared" && logo?.status === "uploading");
      if (stillUploading) throw new Error("รูปยังอัปโหลดไม่เสร็จ");
      const cleanBanners = (banners ?? [])
        .filter((b) => b.status === "done" && b.url)
        .map((b) => b.url);
      return api.shops.update(activeSlug, {
        name: name?.trim() || shop.name,
        description: description?.trim() || null,
        themeColor: themeColor || shop.themeColor,
        announcement: announcement?.trim() || null,
        bannerUrls: cleanBanners,
        logoUrl:
          logo === "cleared"
            ? null
            : logo?.status === "done"
              ? logo.url
              : undefined,
        contact: {
          phone: phone?.trim() || null,
          line: lineContact?.trim() || null,
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shop", activeSlug] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      Alert.alert("บันทึกแล้ว", "ข้อมูลร้านอัปเดตเรียบร้อย", [
        { text: "ตกลง", onPress: () => router.back() },
      ]);
    },
    onError: (err) => {
      Sentry.captureException(err);
      const msg =
        err instanceof ApiClientError ? err.message : "บันทึกไม่สำเร็จ";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  async function pickBanner() {
    if (!banners) return;
    if (banners.length >= MAX_BANNERS) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("ต้องการสิทธิ์เข้าถึงคลังภาพ");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // Shop banners render in a 3:1 wide aspect (h-24 over full width); let
      // the user crop to match so it doesn't get cropped on render.
      allowsEditing: true,
      aspect: [3, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    void uploadBanner(result.assets[0].uri);
  }

  async function uploadBanner(uri: string) {
    if (!banners) return;
    const idx = banners.length;
    setBanners([...banners, { url: "", status: "uploading", localUri: uri }]);
    try {
      const { base64 } = await compressForSlipUpload(uri);
      const res = await api.upload.fromBase64({
        filename: `shop-banner-${Date.now()}.jpg`,
        contentType: "image/jpeg",
        dataBase64: base64,
      });
      setBanners((prev) =>
        prev
          ? prev.map((b, i) =>
              i === idx
                ? { url: res.url, status: "done" as const, localUri: uri }
                : b,
            )
          : prev,
      );
    } catch (err) {
      Sentry.captureException(err);
      setBanners((prev) =>
        prev
          ? prev.map((b, i) =>
              i === idx ? { ...b, status: "error" as const } : b,
            )
          : prev,
      );
      const msg =
        err instanceof ApiClientError ? err.message : "อัปโหลดล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    }
  }

  function removeBanner(idx: number) {
    setBanners((prev) => prev?.filter((_, i) => i !== idx) ?? null);
  }

  async function pickLogo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("ต้องการสิทธิ์เข้าถึงคลังภาพ");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    setLogo({ url: "", status: "uploading", localUri: uri });
    try {
      const { base64 } = await compressForSlipUpload(uri);
      const res = await api.upload.fromBase64({
        filename: `shop-logo-${Date.now()}.jpg`,
        contentType: "image/jpeg",
        dataBase64: base64,
      });
      setLogo({ url: res.url, status: "done", localUri: uri });
    } catch (err) {
      Sentry.captureException(err);
      setLogo({ url: "", status: "error", localUri: uri });
      const msg =
        err instanceof ApiClientError ? err.message : "อัปโหลดล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    }
  }

  if (!activeSlug) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-fg">เลือกร้านก่อน</Text>
        </View>
      </Screen>
    );
  }
  if (shopQuery.isLoading || !shop || banners === null) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  const stillUploading =
    banners.some((b) => b.status === "uploading") ||
    (logo !== "cleared" && logo?.status === "uploading");

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            หน้าร้านของฉัน
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            แต่งร้านให้ดูมืออาชีพ
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            ปกร้านโชว์บนหน้าค้นพบ + หน้าร้าน — เลือกรูปสินค้าเด่นหรือบรรยากาศร้าน
          </Text>
        </View>

        {/* Live preview — mirrors what buyers will see in the shops tab. */}
        <View className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white">
          {banners[0]?.url || banners[0]?.localUri ? (
            <ShopCover
              bannerUrl={banners[0].localUri ?? banners[0].url}
              themeColor={themeColor ?? shop.themeColor}
              logoText={shop.logoText}
              logoUrl={
                logo && logo !== "cleared"
                  ? logo.localUri ?? logo.url
                  : shop.logoUrl
              }
              shopName={name?.trim() || shop.name}
              height={96}
            />
          ) : (
            <ShopCoverFallback
              themeColor={themeColor ?? shop.themeColor}
              logoText={shop.logoText}
              logoUrl={
                logo && logo !== "cleared"
                  ? logo.localUri ?? logo.url
                  : shop.logoUrl
              }
              shopName={name?.trim() || shop.name}
              height={96}
            />
          )}
          <View className="flex-row gap-3 p-4">
            <View
              className="-mt-10 size-14 items-center justify-center overflow-hidden rounded-2xl border-2 border-white"
              style={{ backgroundColor: themeColor ?? shop.themeColor }}
            >
              {logo && logo !== "cleared" && (logo.localUri || logo.url) ? (
                <Image
                  source={{ uri: logo.localUri ?? logo.url }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : (
                <Text className="text-xl font-bold text-white">
                  {shop.logoText ?? shop.name.slice(0, 1)}
                </Text>
              )}
            </View>
            <View className="flex-1">
              <Text
                className="text-[15px] font-semibold text-fg"
                numberOfLines={1}
              >
                {name?.trim() || shop.name}
              </Text>
              {description ? (
                <Text className="mt-0.5 text-[12px] text-muted" numberOfLines={2}>
                  {description}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Banners */}
        <Section title={`ปกร้าน (${banners.length}/${MAX_BANNERS})`}>
          <View className="flex-row flex-wrap gap-2">
            {banners.map((b, i) => (
              <View key={`${b.localUri ?? b.url}-${i}`} className="relative">
                <View className="h-20 w-32 overflow-hidden rounded-2xl border border-border bg-soft">
                  <Image
                    source={{ uri: b.localUri ?? b.url }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                  {b.status === "uploading" ? (
                    <View className="absolute inset-0 items-center justify-center bg-black/40">
                      <ActivityIndicator color="#fff" />
                    </View>
                  ) : null}
                  {b.status === "error" ? (
                    <View className="absolute inset-0 items-center justify-center bg-rose-600/70">
                      <Text className="text-[12px] font-bold text-white">!</Text>
                    </View>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => removeBanner(i)}
                  hitSlop={8}
                  className="absolute -right-1.5 -top-1.5 size-6 items-center justify-center rounded-full bg-rose-600"
                >
                  <Text className="text-[12px] font-bold text-white">×</Text>
                </Pressable>
              </View>
            ))}
            {banners.length < MAX_BANNERS ? (
              <Pressable
                onPress={pickBanner}
                className="h-20 w-32 items-center justify-center rounded-2xl border border-dashed border-border bg-white"
              >
                <Text className="text-[24px]">🖼️</Text>
                <Text className="text-[10px] text-muted">เพิ่มปก</Text>
              </Pressable>
            ) : null}
          </View>
          <Text className="text-[11px] text-muted">
            แนะนำสัดส่วน 3:1 — รูปแนวนอนกว้างๆ จะดูดีที่สุด
          </Text>
        </Section>

        {/* Logo */}
        <Section title="โลโก้">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={pickLogo}
              className="size-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-white"
            >
              {logo && logo !== "cleared" && (logo.localUri || logo.url) ? (
                <Image
                  source={{ uri: logo.localUri ?? logo.url }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : (
                <Text className="text-[28px]">📷</Text>
              )}
              {logo && logo !== "cleared" && logo.status === "uploading" ? (
                <View className="absolute inset-0 items-center justify-center bg-black/40">
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </Pressable>
            <View className="flex-1 gap-2">
              <Pressable
                onPress={pickLogo}
                className="self-start rounded-full bg-brand-600 px-4 py-2"
              >
                <Text className="text-[12px] font-semibold text-white">
                  เปลี่ยนรูป
                </Text>
              </Pressable>
              {logo !== "cleared" && logo ? (
                <Pressable
                  onPress={() => setLogo("cleared")}
                  className="self-start rounded-full border border-border bg-white px-4 py-2"
                >
                  <Text className="text-[12px] font-semibold text-muted">
                    ลบโลโก้
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Section>

        {/* Theme color */}
        <Section title="สีหลักของร้าน">
          <View className="flex-row flex-wrap gap-2">
            {THEME_PRESETS.map((c) => {
              const active = (themeColor ?? shop.themeColor) === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setThemeColor(c)}
                  className={`size-10 items-center justify-center rounded-full ${
                    active ? "border-2 border-fg" : ""
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {active ? (
                    <Text className="text-[12px] font-bold text-white">✓</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Shop name */}
        <Section title="ชื่อร้าน">
          <TextInput
            value={name ?? ""}
            onChangeText={setName}
            maxLength={60}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[15px] text-fg"
          />
        </Section>

        {/* Description */}
        <Section title="คำอธิบายสั้น">
          <TextInput
            value={description ?? ""}
            onChangeText={setDescription}
            placeholder="เช่น ขนมไทยโบราณ ส่งทั่วประเทศ"
            multiline
            maxLength={280}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[14px] text-fg"
            style={{ minHeight: 70, textAlignVertical: "top" }}
          />
          <Text className="text-right text-[10px] text-muted">
            {(description ?? "").length}/280
          </Text>
        </Section>

        {/* Announcement */}
        <Section title="ประกาศบนหน้าร้าน (ไม่จำเป็น)">
          <TextInput
            value={announcement ?? ""}
            onChangeText={setAnnouncement}
            placeholder="เช่น โปรพิเศษวันนี้! ลด 20% เฉพาะออเดอร์แรก"
            multiline
            maxLength={240}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[14px] text-fg"
            style={{ minHeight: 60, textAlignVertical: "top" }}
          />
        </Section>

        {/* Contact */}
        <Section title="ช่องทางติดต่อ">
          <View className="gap-3">
            <View>
              <Text className="text-[11px] text-muted">เบอร์โทร</Text>
              <TextInput
                value={phone ?? ""}
                onChangeText={setPhone}
                placeholder="08x-xxx-xxxx"
                keyboardType="phone-pad"
                className="mt-1 rounded-2xl border border-border bg-white px-3 py-2.5 text-[15px] text-fg"
              />
            </View>
            <View>
              <Text className="text-[11px] text-muted">LINE ID</Text>
              <TextInput
                value={lineContact ?? ""}
                onChangeText={setLineContact}
                placeholder="@yourshop"
                autoCapitalize="none"
                autoCorrect={false}
                className="mt-1 rounded-2xl border border-border bg-white px-3 py-2.5 text-[15px] text-fg"
              />
            </View>
          </View>
        </Section>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white p-4">
        <Button
          disabled={saveMutation.isPending || stillUploading}
          onPress={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : stillUploading ? (
            "กำลังอัปโหลดรูป..."
          ) : (
            "บันทึก"
          )}
        </Button>
      </View>
    </Screen>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mx-5 mt-6 gap-2">
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </Text>
      {children}
    </View>
  );
}
