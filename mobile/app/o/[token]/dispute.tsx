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
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";

/**
 * /o/[token]/dispute — buyer-facing dispute form.
 *
 * Public, no auth required (uses the order's publicToken as proof). Lists
 * existing disputes at the top so the buyer can see they've already opened
 * one; the open-form is hidden when an active dispute exists.
 *
 * Evidence is optional but strongly encouraged — admin resolves much faster
 * with photos. We support up to 5 images, uploaded via the same Vercel Blob
 * pipeline KYC uses.
 */
const REASONS: Array<{
  key:
    | "NOT_RECEIVED"
    | "WRONG_ITEM"
    | "DAMAGED"
    | "NOT_AS_DESCRIBED"
    | "PAYMENT_ISSUE"
    | "OTHER";
  emoji: string;
  label: string;
  description: string;
}> = [
  { key: "NOT_RECEIVED", emoji: "📦", label: "ของไม่มาส่ง", description: "เกินกำหนดส่งหรือไม่ได้รับเลย" },
  { key: "WRONG_ITEM", emoji: "🔁", label: "ของผิด", description: "ได้ของไม่ตรงกับที่สั่ง" },
  { key: "DAMAGED", emoji: "💥", label: "ของเสียหาย", description: "พัสดุแตก/หัก ใช้งานไม่ได้" },
  { key: "NOT_AS_DESCRIBED", emoji: "🤔", label: "ของไม่ตรงปก", description: "คุณภาพไม่ตรงรูป/คำอธิบาย" },
  { key: "PAYMENT_ISSUE", emoji: "💳", label: "ปัญหาเงิน", description: "ถูกหักซ้ำ/เงินไม่ตรง" },
  { key: "OTHER", emoji: "❓", label: "อื่นๆ", description: "เหตุผลอื่น (อธิบายในกล่องข้อความ)" },
];

interface UploadedEvidence {
  kind: "image";
  value: string; // remote URL
  localUri: string;
}

export default function OpenDisputeScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const disputesQuery = useQuery({
    queryKey: ["order", token, "disputes"],
    queryFn: () => api.orders.listDisputes(token!),
    enabled: Boolean(token),
  });

  const hasOpenDispute = (disputesQuery.data?.disputes ?? []).some((d) =>
    ["OPEN", "AWAITING_SHOP_RESPONSE", "AWAITING_BUYER_RESPONSE"].includes(
      d.status,
    ),
  );

  const [reason, setReason] = useState<(typeof REASONS)[number]["key"] | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<UploadedEvidence[]>([]);
  const [uploading, setUploading] = useState(false);

  const openMutation = useMutation({
    mutationFn: () => {
      if (!reason) throw new Error("กรุณาเลือกเหตุผล");
      return api.orders.openDispute(token!, {
        reason,
        description: description.trim(),
        evidence: evidence.map((e) => ({ kind: e.kind, value: e.value })),
      });
    },
    onSuccess: () => {
      Alert.alert(
        "ส่งข้อพิพาทแล้ว",
        "ทีมงานจะตรวจสอบและประสานกับร้านภายใน 72 ชั่วโมง",
        [{ text: "ตกลง", onPress: () => router.replace(`/o/${token}`) }],
      );
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "ส่งล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  async function pickAndUploadEvidence() {
    if (evidence.length >= 5 || uploading) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
      const contentType =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const uploaded = await api.upload.fromBase64({
        filename: `dispute-${Date.now()}.${ext}`,
        contentType,
        dataBase64: base64,
      });
      setEvidence((cur) => [
        ...cur,
        { kind: "image", value: uploaded.url, localUri: asset.uri },
      ]);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "อัปโหลดล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    } finally {
      setUploading(false);
    }
  }

  const canSubmit =
    Boolean(reason) && description.trim().length >= 10 && !openMutation.isPending;

  if (!token) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-fg">เกิดข้อผิดพลาด</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-24">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            เปิดข้อพิพาท
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            มีปัญหากับคำสั่งซื้อ?
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            ทีมงานจะประสานกับร้านภายใน 72 ชั่วโมง ถ้าร้านไม่ตอบ ระบบจะคืนเงินอัตโนมัติ
          </Text>
        </View>

        {/* Existing dispute banner */}
        {hasOpenDispute ? (
          <View className="mx-5 mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <Text className="text-[14px] font-semibold text-amber-900">
              ⏳ มีข้อพิพาทเปิดอยู่แล้ว
            </Text>
            <Text className="mt-1 text-[12px] text-amber-800">
              ทีมงานกำลังตรวจสอบ — เปิดอีกข้อพิพาทไม่ได้จนกว่าจะปิดข้อก่อนหน้า
            </Text>
            <Button
              variant="outline"
              className="mt-3"
              onPress={() => router.replace(`/o/${token}`)}
            >
              กลับหน้าออเดอร์
            </Button>
          </View>
        ) : (
          <>
            {/* Reason selector */}
            <View className="mx-5 mt-4 gap-2">
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                เลือกเหตุผล
              </Text>
              {REASONS.map((r) => {
                const selected = reason === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setReason(r.key)}
                    className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${
                      selected
                        ? "border-brand-300 bg-brand-50"
                        : "border-border bg-white"
                    }`}
                  >
                    <Text className="text-[20px]">{r.emoji}</Text>
                    <View className="flex-1">
                      <Text
                        className={`text-[13px] font-semibold ${
                          selected ? "text-brand-700" : "text-fg"
                        }`}
                      >
                        {r.label}
                      </Text>
                      <Text className="text-[11px] text-muted">
                        {r.description}
                      </Text>
                    </View>
                    {selected ? (
                      <Text className="text-[14px] text-brand-700">✓</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {/* Description */}
            <View className="mx-5 mt-4 gap-2">
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                อธิบายเพิ่มเติม (อย่างน้อย 10 ตัวอักษร)
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="เกิดอะไรขึ้นบ้าง อธิบายให้ทีมงานเข้าใจ..."
                multiline
                maxLength={2000}
                className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[14px] text-fg"
                style={{ minHeight: 100, textAlignVertical: "top" }}
              />
              <Text className="text-right text-[10px] text-muted">
                {description.length}/2000
              </Text>
            </View>

            {/* Evidence */}
            <View className="mx-5 mt-4 gap-2">
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                รูปประกอบ (สูงสุด 5 รูป)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {evidence.map((e, idx) => (
                  <View
                    key={idx}
                    className="size-20 overflow-hidden rounded-xl bg-soft"
                  >
                    <Image
                      source={{ uri: e.localUri }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                    <Pressable
                      onPress={() =>
                        setEvidence((cur) => cur.filter((_, i) => i !== idx))
                      }
                      className="absolute right-1 top-1 size-5 items-center justify-center rounded-full bg-black/60"
                    >
                      <Text className="text-[12px] text-white">×</Text>
                    </Pressable>
                  </View>
                ))}
                {evidence.length < 5 ? (
                  <Pressable
                    onPress={pickAndUploadEvidence}
                    disabled={uploading}
                    className="size-20 items-center justify-center rounded-xl border-2 border-dashed border-border bg-white"
                  >
                    {uploading ? (
                      <ActivityIndicator color="#e11d48" />
                    ) : (
                      <Text className="text-[24px]">+</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View className="mx-5 mt-6">
              <Button
                disabled={!canSubmit}
                onPress={() => openMutation.mutate()}
              >
                {openMutation.isPending ? "กำลังส่ง..." : "ส่งข้อพิพาท"}
              </Button>
            </View>

            <View className="mx-5 mt-4 rounded-2xl border border-dashed border-border p-4">
              <Text className="text-[11px] leading-relaxed text-muted">
                💡 เคล็ดลับ: รูปประกอบทำให้ทีมงานตัดสินได้เร็วขึ้นมาก
                — ถ่ายของจริง + กล่องพัสดุ + slip ถ้ามีปัญหาเรื่องการชำระเงิน
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
