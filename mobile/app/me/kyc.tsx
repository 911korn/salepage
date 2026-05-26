import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/trust-badge";
import { api, ApiClientError } from "@/lib/api";

type DocType = "NID" | "PASSPORT" | "COMPANY_REG";

/**
 * /me/kyc — KYC submission entry point.
 *
 * Two-stage UI:
 *  1. List of shops the user owns with their current KYC status.
 *  2. Tap a shop → expand into the submission wizard for that shop.
 *
 * The wizard accepts: docType, legalName, idLast4, docFrontUrl, docBackUrl
 * (optional for passports), selfieUrl. Doc URLs are produced by uploading
 * via `/api/v1/upload` (Vercel Blob).
 */
export default function KycScreen() {
  const shopsQuery = useQuery({
    queryKey: ["me", "shops"],
    queryFn: () => api.me.shops(),
  });
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-24">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            ยืนยันตัวตน
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            KYC สำหรับร้านของคุณ
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            ร้านที่ผ่านการยืนยันจะได้แบดจ์ ✓ และ Trust Score เพิ่มขึ้นทันที +25 คะแนน
            ลูกค้าเชื่อใจมากขึ้น เพิ่มยอดขาย
          </Text>
        </View>

        {shopsQuery.isLoading ? (
          <View className="py-16">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : shopsQuery.data?.shops.length === 0 ? (
          <View className="mx-5 mt-8 items-center rounded-3xl border border-dashed border-border p-8">
            <Text className="text-[14px] font-semibold text-fg">
              ยังไม่มีร้านในบัญชีนี้
            </Text>
            <Text className="mt-1 text-center text-[12px] text-muted">
              สร้างร้านได้ที่ Dashboard บนเว็บ
            </Text>
            <Button
              variant="outline"
              className="mt-4"
              onPress={() => router.replace("/")}
            >
              กลับหน้าแรก
            </Button>
          </View>
        ) : (
          <View className="mt-4 gap-3 px-5">
            {shopsQuery.data?.shops.map((shop) => (
              <ShopKycRow
                key={shop.id}
                shop={shop}
                expanded={activeSlug === shop.slug}
                onToggle={() =>
                  setActiveSlug(activeSlug === shop.slug ? null : shop.slug)
                }
                onSubmitted={() => {
                  setActiveSlug(null);
                  void shopsQuery.refetch();
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function ShopKycRow({
  shop,
  expanded,
  onToggle,
  onSubmitted,
}: {
  shop: {
    id: string;
    slug: string;
    name: string;
    logoText: string | null;
    logoUrl: string | null;
    themeColor: string;
    kycStatus: "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
    trustScore: number;
  };
  expanded: boolean;
  onToggle: () => void;
  onSubmitted: () => void;
}) {
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-white">
      <Pressable onPress={onToggle} className="flex-row items-center gap-3 p-4">
        <View
          className="size-12 items-center justify-center overflow-hidden rounded-xl"
          style={{ backgroundColor: shop.themeColor }}
        >
          {shop.logoUrl ? (
            <Image
              source={{ uri: shop.logoUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <Text className="text-[16px] font-bold text-white">
              {shop.logoText ?? shop.name.slice(0, 1)}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text
              className="text-[14px] font-semibold text-fg"
              numberOfLines={1}
            >
              {shop.name}
            </Text>
            <VerifiedBadge kycStatus={shop.kycStatus} compact />
          </View>
          <KycStatusLine
            status={shop.kycStatus}
            trustScore={shop.trustScore}
          />
        </View>
        <Text className="text-[14px] text-muted">{expanded ? "▴" : "▾"}</Text>
      </Pressable>

      {expanded ? (
        <View className="border-t border-border bg-soft/30">
          {shop.kycStatus === "VERIFIED" ? (
            <Text className="p-4 text-[12px] text-emerald-700">
              ✓ ร้านนี้ได้รับการยืนยันแล้ว — หากต้องการแก้ไข กรุณาติดต่อทีมงาน
            </Text>
          ) : shop.kycStatus === "PENDING" ? (
            <Text className="p-4 text-[12px] text-amber-700">
              ⏳ กำลังรอทีมงานตรวจสอบ — ปกติใช้เวลา 1–2 วันทำการ
            </Text>
          ) : (
            <KycWizard slug={shop.slug} onSubmitted={onSubmitted} />
          )}
        </View>
      ) : null}
    </View>
  );
}

function KycStatusLine({
  status,
  trustScore,
}: {
  status: string;
  trustScore: number;
}) {
  const map: Record<string, { label: string; color: string }> = {
    NONE: { label: "ยังไม่ยืนยัน", color: "text-muted" },
    PENDING: { label: "กำลังตรวจสอบ", color: "text-amber-700" },
    VERIFIED: { label: "ยืนยันแล้ว", color: "text-emerald-700" },
    REJECTED: { label: "ถูกปฏิเสธ — ส่งใหม่ได้", color: "text-rose-600" },
    EXPIRED: { label: "หมดอายุ — ต่ออายุได้", color: "text-rose-600" },
  };
  const m = map[status] ?? map.NONE!;
  return (
    <Text className={`mt-0.5 text-[11px] ${m.color}`}>
      {m.label} · Trust {trustScore}
    </Text>
  );
}

function KycWizard({
  slug,
  onSubmitted,
}: {
  slug: string;
  onSubmitted: () => void;
}) {
  const [docType, setDocType] = useState<DocType>("NID");
  const [legalName, setLegalName] = useState("");
  const [idLast4, setIdLast4] = useState("");
  const [docFront, setDocFront] = useState<UploadedImage | null>(null);
  const [docBack, setDocBack] = useState<UploadedImage | null>(null);
  const [selfie, setSelfie] = useState<UploadedImage | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsBack = docType !== "PASSPORT";
  const ready =
    legalName.trim().length >= 2 &&
    /^\d{4}$/.test(idLast4) &&
    docFront !== null &&
    selfie !== null &&
    (!needsBack || docBack !== null);

  async function handleSubmit() {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.shops.submitKyc(slug, {
        docType,
        legalName: legalName.trim(),
        idLast4,
        docFrontUrl: docFront!.url,
        docBackUrl: needsBack ? docBack!.url : undefined,
        selfieUrl: selfie!.url,
      });
      Alert.alert(
        "ส่งเอกสารแล้ว",
        `สถานะ: ${res.kycStatus} — ทีมงานจะตรวจสอบภายใน 1–2 วันทำการ`,
        [{ text: "ตกลง", onPress: onSubmitted }],
      );
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "ส่งเอกสารไม่สำเร็จ";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="gap-3 p-4">
      <Text className="text-[12px] text-muted">
        กรอกข้อมูลตรงตามเอกสารจริง — ข้อมูลปลอมจะถูกระงับร้านทันที
      </Text>

      {/* Doc type */}
      <View className="gap-1.5">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          ประเภทเอกสาร
        </Text>
        <View className="flex-row gap-2">
          {(
            [
              { key: "NID", label: "บัตรประชาชน" },
              { key: "PASSPORT", label: "พาสปอร์ต" },
              { key: "COMPANY_REG", label: "ทะเบียนบริษัท" },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setDocType(opt.key)}
              className={`flex-1 rounded-xl border px-3 py-2 ${
                docType === opt.key
                  ? "border-brand-300 bg-brand-50"
                  : "border-border bg-white"
              }`}
            >
              <Text
                className={`text-center text-[11px] font-semibold ${
                  docType === opt.key ? "text-brand-700" : "text-fg"
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Legal name */}
      <Field
        label="ชื่อ-นามสกุล (ตามเอกสาร)"
        value={legalName}
        onChangeText={setLegalName}
        placeholder="เช่น นาย สมชาย ใจดี"
      />

      {/* Last 4 digits */}
      <Field
        label="เลขท้าย 4 หลักของเลขเอกสาร"
        value={idLast4}
        onChangeText={(v: string) =>
          setIdLast4(v.replace(/[^\d]/g, "").slice(0, 4))
        }
        placeholder="เช่น 1234"
        keyboardType="number-pad"
        maxLength={4}
      />

      {/* Front */}
      <ImageField
        label={
          docType === "PASSPORT"
            ? "ภาพหน้าพาสปอร์ต"
            : docType === "COMPANY_REG"
              ? "ทะเบียนบริษัทหน้าแรก"
              : "บัตรประชาชนด้านหน้า"
        }
        value={docFront}
        onChange={setDocFront}
      />

      {/* Back (only for NID + Company Reg) */}
      {needsBack ? (
        <ImageField
          label={
            docType === "COMPANY_REG"
              ? "ทะเบียนบริษัทหน้าหลัง / หน้าหุ้นส่วน"
              : "บัตรประชาชนด้านหลัง"
          }
          value={docBack}
          onChange={setDocBack}
        />
      ) : null}

      {/* Selfie */}
      <ImageField
        label="เซลฟี่ถือบัตรข้างใบหน้า"
        value={selfie}
        onChange={setSelfie}
        useFrontCamera
      />

      <Button onPress={handleSubmit} disabled={!ready || submitting}>
        {submitting ? "กำลังส่ง..." : "ส่งเอกสารยืนยัน"}
      </Button>
      <Text className="text-[11px] leading-relaxed text-muted">
        เราใช้เอกสารเพื่อยืนยันตัวตนเท่านั้น ไม่เปิดเผยต่อบุคคลที่สาม
      </Text>
    </View>
  );
}

interface UploadedImage {
  url: string;
  pathname: string;
  localUri: string;
}

function ImageField({
  label,
  value,
  onChange,
  useFrontCamera,
}: {
  label: string;
  value: UploadedImage | null;
  onChange: (img: UploadedImage | null) => void;
  useFrontCamera?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  async function pickAndUpload() {
    if (uploading) return;
    // Selfie uses camera, doc photos use library — pragmatic UX so users
    // don't accidentally pick stale screenshots for the selfie step.
    const result = useFrontCamera
      ? await ImagePicker.launchCameraAsync({
          cameraType: ImagePicker.CameraType.front,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
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
      const filename = `kyc-${Date.now()}.${ext}`;
      const uploaded = await api.upload.fromBase64({
        filename,
        contentType,
        dataBase64: base64,
      });
      onChange({
        url: uploaded.url,
        pathname: uploaded.pathname,
        localUri: asset.uri,
      });
    } catch (e) {
      const msg =
        e instanceof ApiClientError ? e.message : "อัปโหลดรูปไม่สำเร็จ";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View className="gap-1.5">
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </Text>
      <Pressable
        onPress={pickAndUpload}
        className={`overflow-hidden rounded-2xl border-2 border-dashed ${
          value ? "border-emerald-300" : "border-border"
        } bg-white`}
        style={{ minHeight: 140 }}
      >
        {value ? (
          <Image
            source={{ uri: value.localUri }}
            style={{ width: "100%", height: 200 }}
            contentFit="cover"
          />
        ) : (
          <View className="items-center justify-center py-12">
            {uploading ? (
              <ActivityIndicator color="#e11d48" />
            ) : (
              <>
                <Text className="text-[24px]">📷</Text>
                <Text className="mt-1 text-[12px] text-muted">
                  แตะเพื่อ{useFrontCamera ? "ถ่ายเซลฟี่" : "เลือกรูป"}
                </Text>
              </>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad";
  maxLength?: number;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[14px] text-fg"
      />
    </View>
  );
}
