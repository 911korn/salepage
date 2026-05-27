import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react-native";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { useSellerMode } from "@/store/seller-mode";
import { Sentry } from "@/lib/sentry";

/**
 * /seller/create-shop — first-time shop creation on mobile.
 *
 * Mirrors the web 3-step wizard but as a single screen with the
 * essentials. Pickup address fields are surfaced here so every label
 * the shop generates has a sender by default (911korn 2026-05-27
 * "ต้องให้ร้านระบุที่อยู่ผู้ส่งไว้ เป็นค่าเริ่มต้นของร้านด้วย").
 *
 * After create → /seller (the dashboard home).
 */

const CATEGORIES = [
  { key: "fashion", label: "แฟชั่น" },
  { key: "food", label: "อาหาร" },
  { key: "tech", label: "ไอที" },
  { key: "beauty", label: "ความงาม" },
  { key: "health", label: "สุขภาพ" },
  { key: "furniture", label: "เฟอร์นิเจอร์" },
  { key: "pets", label: "สัตว์เลี้ยง" },
  { key: "books", label: "หนังสือ" },
  { key: "sport", label: "กีฬา" },
  { key: "other", label: "อื่นๆ" },
] as const;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `shop-${Math.random().toString(36).slice(2, 8)}`
  );
}

export default function CreateShopScreen() {
  const queryClient = useQueryClient();
  const setMode = useSellerMode((s) => s.setMode);
  const setActiveShop = useSellerMode((s) => s.setActiveShop);

  const [name, setName] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [promptpayId, setPromptpayId] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupPostcode, setPickupPostcode] = useState("");

  // Live-derive slug from name unless the seller manually edits it
  // (911korn 2026-05-27 "ตอนสร้างร้านใน App ลืมใส่ให้ตั้ง Slug หรือเปล่า").
  // Same lenient-input pattern as the web wizard: store the raw input
  // so Thai keystrokes echo, then slugify on read.
  const slug = useMemo(
    () => slugify(slugDirty ? slugInput : name),
    [name, slugInput, slugDirty],
  );
  const slugDisplay = slugDirty ? slugInput : slugify(name);
  const slugNeedsNormalisation =
    slugDisplay.length > 0 && slugDisplay !== slug;
  const postcodeOk =
    !pickupPostcode || /^\d{5}$/.test(pickupPostcode);
  const canSubmit =
    name.trim().length >= 2 &&
    slug.length >= 3 &&
    Boolean(category) &&
    (promptpayId.trim().length >= 9 || phone.trim().length >= 9) &&
    postcodeOk;

  const createMutation = useMutation({
    mutationFn: () =>
      api.shops.create({
        name: name.trim(),
        slug,
        category: category ?? undefined,
        promptpayId: promptpayId.trim() || undefined,
        contact: phone.trim() ? { phone: phone.trim() } : undefined,
        pickupAddress: pickupAddress.trim() || undefined,
        pickupPostcode: pickupPostcode.trim() || undefined,
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["me", "shops"] });
      // Auto-switch into seller mode for the new shop so the dashboard
      // lands on the right context.
      setActiveShop(res.shop.slug);
      setMode("seller");
      Alert.alert("เปิดร้านเรียบร้อย", `${res.shop.name} พร้อมขาย`, [
        { text: "เริ่มขาย", onPress: () => router.replace("/seller") },
      ]);
    },
    onError: (err) => {
      Sentry.captureException(err);
      Alert.alert(
        "เปิดร้านไม่สำเร็จ",
        err instanceof ApiClientError ? err.message : "ลองใหม่",
      );
    },
  });

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView
          contentContainerClassName="px-5 pt-6 pb-40"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <View className="flex-row items-center gap-2">
            <Sparkles size={18} color="#e11d48" strokeWidth={2.2} />
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">
              เปิดร้านของคุณ
            </Text>
          </View>
          <Text className="mt-1 text-[22px] font-bold text-fg">
            สร้างร้านใน 30 วินาที
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            กรอกแค่ที่จำเป็น เริ่มขายได้ทันที — ไปแต่งร้านเพิ่มทีหลังในตั้งค่า
          </Text>

          {/* Name */}
          <Section title="ชื่อร้าน *">
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (!slugDirty) setSlugInput("");
              }}
              placeholder="เช่น ของกินเมืองเหนือ"
              maxLength={60}
              className="rounded-2xl border border-border bg-white px-3 py-3 text-[15px] text-fg"
            />
          </Section>

          {/* Slug — editable. Live-mirrors slugify(name) until seller
              taps in to override. Same lenient-keystroke pattern as web. */}
          <Section
            title="ลิงก์ร้าน *"
            hint={
              slugNeedsNormalisation
                ? `→ จะกลายเป็น salepage.in.th/${slug} (a-z, 0-9, ขีดกลางเท่านั้น)`
                : "เปลี่ยนภายหลังได้ในตั้งค่า · ตัวอักษรอังกฤษ/ตัวเลข/ขีดกลาง"
            }
          >
            <View className="flex-row items-center rounded-2xl border border-border bg-white px-3">
              <Text className="text-[13px] text-muted">salepage.in.th/</Text>
              <TextInput
                value={slugDisplay}
                onChangeText={(v) => {
                  setSlugInput(v);
                  setSlugDirty(true);
                }}
                placeholder="my-shop"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={40}
                className="flex-1 py-3 text-[15px] text-fg"
              />
            </View>
          </Section>

          {/* Category */}
          <Section title="หมวดหมู่ร้าน *">
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    className={`rounded-full border px-3 py-1.5 ${
                      active
                        ? "border-brand-300 bg-brand-50"
                        : "border-border bg-white"
                    }`}
                  >
                    <Text
                      className={`text-[13px] ${
                        active ? "font-semibold text-brand-700" : "text-fg"
                      }`}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* PromptPay */}
          <Section
            title="PromptPay รับเงิน *"
            hint="ลูกค้าจะโอนเงินตรงเข้าบัญชีนี้ ระบบไม่หักค่าธรรมเนียม"
          >
            <TextInput
              value={promptpayId}
              onChangeText={setPromptpayId}
              placeholder="เบอร์มือถือ หรือเลขบัตรประชาชน"
              keyboardType="number-pad"
              maxLength={20}
              className="rounded-2xl border border-border bg-white px-3 py-3 text-[15px] text-fg"
            />
          </Section>

          {/* Phone contact */}
          <Section title="เบอร์ติดต่อร้าน">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="08x-xxx-xxxx"
              keyboardType="phone-pad"
              maxLength={20}
              className="rounded-2xl border border-border bg-white px-3 py-3 text-[15px] text-fg"
            />
          </Section>

          {/* Pickup address */}
          <Section
            title="ที่อยู่ผู้ส่ง · พิมพ์ในใบปะหน้า"
            hint="ลูกค้าไม่เห็น · ใช้ตอนคุณ drop ที่ courier"
          >
            <TextInput
              value={pickupAddress}
              onChangeText={setPickupAddress}
              placeholder="999 ซอย XX ถนน YY แขวง เขต กรุงเทพฯ"
              multiline
              maxLength={500}
              className="rounded-2xl border border-border bg-white px-3 py-3 text-[14px] text-fg"
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
            <TextInput
              value={pickupPostcode}
              onChangeText={(v) =>
                setPickupPostcode(v.replace(/[^\d]/g, "").slice(0, 5))
              }
              placeholder="รหัสไปรษณีย์ 5 หลัก"
              keyboardType="number-pad"
              maxLength={5}
              className="mt-2 rounded-2xl border border-border bg-white px-3 py-3 text-[15px] text-fg"
            />
            {!postcodeOk ? (
              <Text className="text-[11px] text-rose-600">ต้องเป็น 5 หลัก</Text>
            ) : null}
          </Section>

          <Button
            className="mt-8"
            loading={createMutation.isPending}
            disabled={!canSubmit || createMutation.isPending}
            onPress={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              "เปิดร้าน → เริ่มขาย"
            )}
          </Button>
          <Button
            className="mt-2"
            variant="outline"
            onPress={() => router.back()}
          >
            ยกเลิก
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-5 gap-2">
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </Text>
      {children}
      {hint ? <Text className="text-[11px] text-muted">{hint}</Text> : null}
    </View>
  );
}
