import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";
import { safeBack } from "@/lib/safe-back";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { compressForSlipUpload } from "@/lib/image-compress";
import { Sentry } from "@/lib/sentry";

/**
 * /me/edit — change avatar + display name. 911korn 2026-05-27 first
 * TestFlight feedback: "รูปโปร์ไฟล์กับชื่อ เปลี่ยนไม่ได้".
 *
 * Flow:
 *   1. Tap avatar → camera / library picker → compress 640px → upload
 *      to /api/v1/upload → returns public Blob URL.
 *   2. Save → PATCH /api/v1/me with name + image fields.
 *   3. Pop back; the /me tab re-queries on focus.
 */
export default function EditProfileScreen() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me.profile(),
  });

  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (seeded || !profileQuery.data) return;
    queueMicrotask(() => {
      setName(profileQuery.data?.name ?? "");
      setImageUrl(profileQuery.data?.image ?? null);
      setSeeded(true);
    });
  }, [profileQuery.data, seeded]);

  async function pickAndUpload() {
    Alert.alert("เปลี่ยนรูปโปรไฟล์", "เลือกแหล่งรูป", [
      { text: "ยกเลิก", style: "cancel" },
      { text: "ถ่ายรูป", onPress: () => uploadFrom("camera") },
      { text: "เลือกจากคลังภาพ", onPress: () => uploadFrom("library") },
    ]);
  }

  async function uploadFrom(source: "camera" | "library") {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("ต้องการสิทธิ์");
      return;
    }
    const launch =
      source === "camera"
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;
    const result = await launch({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const { base64 } = await compressForSlipUpload(result.assets[0].uri, "thumb");
      const res = await api.upload.fromBase64({
        filename: `avatar-${Date.now()}.jpg`,
        contentType: "image/jpeg",
        dataBase64: base64,
      });
      setImageUrl(res.url);
    } catch (err) {
      Sentry.captureException(err);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof ApiClientError ? err.message : "อัปโหลดไม่สำเร็จ",
      );
    } finally {
      setUploading(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      api.me.updateProfile({
        name: name.trim() || null,
        image: imageUrl,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      Alert.alert("บันทึกแล้ว", "อัปเดตโปรไฟล์เรียบร้อย", [
        { text: "ตกลง", onPress: () => safeBack() },
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

  if (!seeded) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pt-6 pb-32">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          แก้ไขโปรไฟล์
        </Text>
        <Text className="mt-1 text-[20px] font-bold text-fg">
          ชื่อ + รูปของคุณ
        </Text>

        {/* Avatar */}
        <View className="mt-6 items-center">
          <Pressable
            onPress={pickAndUpload}
            disabled={uploading}
            className="relative"
          >
            <View className="size-32 overflow-hidden rounded-full bg-brand-100">
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : (
                <View className="size-full items-center justify-center">
                  <Text className="text-[40px] font-bold text-brand-700">
                    {(name || profileQuery.data?.email || "?")
                      .slice(0, 1)
                      .toUpperCase()}
                  </Text>
                </View>
              )}
              {uploading ? (
                <View className="absolute inset-0 items-center justify-center bg-black/40">
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </View>
            <View className="absolute bottom-0 right-0 size-9 items-center justify-center rounded-full border-2 border-white bg-zinc-900">
              <Camera size={16} color="#fff" strokeWidth={2.2} />
            </View>
          </Pressable>
          <Text className="mt-3 text-[12px] text-muted">
            กดที่รูปเพื่อเปลี่ยน
          </Text>
        </View>

        {/* Name */}
        <View className="mt-8">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            ชื่อแสดง
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="ใส่ชื่อของคุณ"
            maxLength={80}
            className="mt-2 rounded-2xl border border-border bg-white px-3 py-3 text-[15px] text-fg"
          />
        </View>

        {/* Email (read-only) */}
        <View className="mt-5">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            อีเมล (เปลี่ยนไม่ได้)
          </Text>
          <View className="mt-2 rounded-2xl border border-dashed border-border bg-soft px-3 py-3">
            <Text className="text-[15px] text-muted">
              {profileQuery.data?.email}
            </Text>
          </View>
        </View>

        <Button
          className="mt-8"
          loading={saveMutation.isPending}
          disabled={saveMutation.isPending || uploading}
          onPress={() => saveMutation.mutate()}
        >
          บันทึก
        </Button>
        <Button
          className="mt-2"
          variant="outline"
          onPress={() => safeBack()}
        >
          ยกเลิก
        </Button>
      </ScrollView>
    </Screen>
  );
}
