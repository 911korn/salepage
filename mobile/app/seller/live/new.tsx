import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { useSellerMode } from "@/store/seller-mode";

/**
 * /seller/live/new — schedule a new broadcast.
 *
 * Minimal form: title (required) + optional description. Cover image upload
 * lands in V2.1 (we already have the Vercel Blob pipeline; just need to
 * port the same pattern as Stories). Optional `scheduledAt` lets sellers
 * pre-announce — empty means "create it ready to go now".
 */
export default function NewLiveBroadcastScreen() {
  const activeSlug = useSellerMode((s) => s.activeShopSlug);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: () => {
      if (!activeSlug) throw new Error("ไม่มีร้านที่ใช้งานอยู่");
      return api.live.create(activeSlug, {
        title: title.trim(),
        description: description.trim() || undefined,
      });
    },
    onSuccess: (res) => {
      Alert.alert(
        "สร้างไลฟ์เรียบร้อย",
        `\"${res.broadcast.title}\" ถูกบันทึกเป็น SCHEDULED — กดปุ่ม &quot;เริ่ม&quot; ที่หน้าหลัก /seller/live เพื่อ go live`,
        [{ text: "ตกลง", onPress: () => router.replace("/seller/live") }],
      );
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "สร้างไลฟ์ล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  const canSubmit =
    title.trim().length >= 2 && Boolean(activeSlug) && !createMutation.isPending;

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
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            สร้างไลฟ์ใหม่
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            ตั้งชื่อ + คำอธิบายให้ลูกค้า
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            หลังสร้างจะเป็นสถานะ SCHEDULED — กด &quot;เริ่ม&quot; เพื่อ go live + ส่ง push
            ให้ผู้ติดตาม
          </Text>
        </View>

        <View className="mx-5 mt-4 gap-2">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            ชื่อไลฟ์
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="เช่น เปิดของใหม่ + แจกโค้ดส่วนลด"
            maxLength={120}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[15px] text-fg"
          />
          <Text className="text-right text-[10px] text-muted">
            {title.length}/120
          </Text>
        </View>

        <View className="mx-5 mt-4 gap-2">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            คำอธิบาย (ไม่จำเป็น)
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="รายละเอียดเพิ่มเติม โปรโมชั่น ฯลฯ"
            multiline
            maxLength={2000}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[14px] text-fg"
            style={{ minHeight: 100, textAlignVertical: "top" }}
          />
          <Text className="text-right text-[10px] text-muted">
            {description.length}/2000
          </Text>
        </View>

        <View className="mx-5 mt-4 rounded-2xl border border-dashed border-border p-4">
          <Text className="text-[11px] leading-relaxed text-muted">
            🎥 V2.0: ระบบกล้องในแอปกำลัง integrate กับ RTC provider
            ตอนนี้ใช้แอปอื่นถ่ายไลฟ์ได้ — เราจะส่ง push ให้ followers + เปิดให้ลูกค้า
            comment + ปักหมุดสินค้าแบบ real-time
          </Text>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white p-4">
        <Button
          disabled={!canSubmit}
          onPress={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            "บันทึก + เตรียมไลฟ์"
          )}
        </Button>
      </View>
    </Screen>
  );
}
