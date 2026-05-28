import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Sparkles,
  Trash2,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { compressForSlipUpload } from "@/lib/image-compress";
import { useSellerMode } from "@/store/seller-mode";
import { Sentry } from "@/lib/sentry";

const MAX_PHOTOS = 20;
const SUGGESTED_PER_PHOTO = 5;

/**
 * /seller/shipping/bulk-scan — mobile companion to the web Bulk Tracking
 * flow. Multi-photo capture via expo-camera (snap-snap-snap), all calls
 * hit the same /api/v1/shops/[slug]/shipping/bulk-receipt-{scan,apply}
 * endpoints that the web dashboard uses.
 *
 * 911korn 2026-05-28 "ทำมาเลยให้ครบเลย" — Phase 2 mobile counterpart
 * to the web Phase 1 MVP. Free for every tier (911korn 2026-05-29
 * "ปล่อย Free ก่อนเลย ให้คนใช้เยอะๆ").
 */

type Status = "auto" | "review" | "unmatched";

interface PhotoFile {
  id: string;
  uri: string;
  base64: string;
  contentType: "image/jpeg";
}

interface MatchedReceipt {
  trackingNumber: string;
  receiverName: string | null;
  postcode: string | null;
  phoneTail: string | null;
  courier: string | null;
  confidence: "high" | "medium" | "low";
  photoIndex: number;
  indexInPhoto: number;
  bbox: [number, number, number, number] | null;
  status: Status;
  labelPaired: boolean;
  candidates: Array<{ orderId: string; publicToken: string; score: number }>;
}

interface CandidateOrder {
  orderId: string;
  publicToken: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  totalSatang: number;
  createdAt: string;
  labelPrintedAt: string | null;
}

interface ScanResponse {
  matches: MatchedReceipt[];
  candidatePool: CandidateOrder[];
  duplicates: Array<{
    trackingNumber: string;
    assignedToOrderToken: string;
  }>;
  message?: string;
}

type Decision = { kind: "approve"; orderId: string } | { kind: "skip" };

export default function BulkScanScreen() {
  const activeShopSlug = useSellerMode((s) => s.activeShopSlug);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const scanMutation = useMutation({
    mutationFn: async () => {
      if (!activeShopSlug) throw new Error("no active shop");
      return api.shops.bulkScanReceipts(activeShopSlug, {
        photos: photos.map((p) => ({
          dataBase64: p.base64,
          contentType: p.contentType,
        })),
      });
    },
    onSuccess: (data) => {
      const matches = data.matches as MatchedReceipt[];
      const init: Record<string, Decision> = {};
      for (const m of matches) {
        if (m.status === "auto" && m.candidates[0]) {
          init[m.trackingNumber] = {
            kind: "approve",
            orderId: m.candidates[0].orderId,
          };
        } else {
          init[m.trackingNumber] = { kind: "skip" };
        }
      }
      setDecisions(init);
      setScanResult({
        matches,
        candidatePool: data.candidatePool as CandidateOrder[],
        duplicates: data.duplicates as ScanResponse["duplicates"],
        message: data.message,
      });
      if (data.message) Alert.alert("AI Bulk Tracking", data.message);
    },
    onError: (err) => {
      Sentry.captureException(err);
      Alert.alert(
        "สแกนไม่สำเร็จ",
        err instanceof ApiClientError ? err.message : "ลองอีกครั้ง",
      );
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!activeShopSlug || !scanResult) {
        throw new Error("missing state");
      }
      const applies = Object.entries(decisions)
        .filter(([, d]) => d.kind === "approve")
        .map(([trackingNumber, d]) => {
          const m = scanResult.matches.find(
            (x) => x.trackingNumber === trackingNumber,
          );
          return {
            orderId: (d as { kind: "approve"; orderId: string }).orderId,
            trackingNumber,
            courier: m?.courier ?? null,
          };
        });
      if (applies.length === 0) {
        throw new Error("ยังไม่ได้เลือกออเดอร์");
      }
      return api.shops.bulkApplyReceipts(activeShopSlug, { applies });
    },
    onSuccess: (data) => {
      Alert.alert(
        "อัปเดต tracking สำเร็จ",
        `${data.applied.length} ออเดอร์ส่งของแล้ว · ลูกค้าได้รับ email + LINE${
          data.skipped.length > 0 ? `\n(ข้าม ${data.skipped.length} รายการ)` : ""
        }`,
        [
          {
            text: "ดูออเดอร์",
            onPress: () => router.replace("/seller/orders"),
          },
        ],
      );
    },
    onError: (err) => {
      Sentry.captureException(err);
      Alert.alert(
        "ยืนยันไม่สำเร็จ",
        err instanceof ApiClientError ? err.message : "ลองอีกครั้ง",
      );
    },
  });

  async function snapPhoto() {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("ครบ 20 รูปแล้ว", "ลบรูปบางใบหรือสแกนรอบนี้ก่อน");
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("ต้องการสิทธิ์ใช้กล้อง", "เปิดในการตั้งค่า > SalePage");
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (shot.canceled || !shot.assets[0]) return;
    try {
      const { uri, base64 } = await compressForSlipUpload(shot.assets[0].uri);
      setPhotos((p) => [
        ...p,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          uri,
          base64,
          contentType: "image/jpeg",
        },
      ]);
    } catch (err) {
      Sentry.captureException(err);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof ApiClientError ? err.message : "ประมวลผลรูปไม่สำเร็จ",
      );
    }
  }

  async function pickFromGallery() {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("ครบ 20 รูปแล้ว", "ลบรูปบางใบหรือสแกนรอบนี้ก่อน");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("ต้องการสิทธิ์เข้าแกลเลอรี", "เปิดในการตั้งค่า > SalePage");
      return;
    }
    const remaining = MAX_PHOTOS - photos.length;
    const shot = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.9,
    });
    if (shot.canceled || shot.assets.length === 0) return;
    try {
      const added: PhotoFile[] = [];
      for (const asset of shot.assets) {
        const { uri, base64 } = await compressForSlipUpload(asset.uri);
        added.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          uri,
          base64,
          contentType: "image/jpeg",
        });
      }
      setPhotos((p) => [...p, ...added]);
    } catch (err) {
      Sentry.captureException(err);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof ApiClientError ? err.message : "ประมวลผลรูปไม่สำเร็จ",
      );
    }
  }

  function removePhoto(id: string) {
    setPhotos((p) => p.filter((x) => x.id !== id));
  }

  if (!activeShopSlug) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-fg">กรุณาเลือกร้าน</Text>
        </View>
      </Screen>
    );
  }

  if (scanResult) {
    return (
      <ReviewView
        scanResult={scanResult}
        photos={photos}
        decisions={decisions}
        setDecisions={setDecisions}
        applying={applyMutation.isPending}
        onApply={() => applyMutation.mutate()}
        onReset={() => {
          setScanResult(null);
          setDecisions({});
        }}
      />
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-24">
        <View className="mx-5 mt-5">
          <View className="flex-row items-center gap-2">
            <Text className="text-[24px] font-bold text-fg">
              AI Bulk Tracking
            </Text>
            <View className="rounded-full bg-emerald-500/15 px-2 py-0.5">
              <Text className="text-[9.5px] font-bold uppercase text-emerald-700">
                Free
              </Text>
            </View>
          </View>
          <Text className="mt-1 text-[12.5px] leading-relaxed text-muted">
            ถ่ายรูปใบเสร็จขนส่งเป็นกอง · AI อ่านทุกใบ จับคู่กับออเดอร์ที่จ่ายแล้วให้ทันที
          </Text>

          <View className="mt-3 flex-row items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
            <Sparkles size={14} color="#be123c" />
            <Text className="flex-1 text-[11.5px] leading-relaxed text-zinc-700">
              <Text className="font-bold">เทคนิคไปรษณีย์ไทย / J&T eCo:</Text> ถ่ายใบเสร็จคู่กับ "ใบปะหน้า" ของเรา (มี QR + เลข Order) ในรูปเดียวกัน → AI pair อัตโนมัติแม้ใบเสร็จไม่มีชื่อ
            </Text>
          </View>
        </View>

        {/* Photo grid */}
        <View className="mx-5 mt-5 flex-row flex-wrap gap-2">
          {photos.map((p, i) => (
            <View
              key={p.id}
              className="relative h-[110px] w-[110px] overflow-hidden rounded-2xl border border-border bg-soft"
            >
              <Image
                source={{ uri: p.uri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
              <Pressable
                onPress={() => removePhoto(p.id)}
                className="absolute right-1 top-1 size-7 items-center justify-center rounded-full bg-zinc-900/70"
              >
                <Trash2 size={14} color="#fff" />
              </Pressable>
              <View className="absolute bottom-1 left-1 rounded-full bg-zinc-900/70 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold text-white">
                  #{i + 1}
                </Text>
              </View>
            </View>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <Pressable
              onPress={snapPhoto}
              className="h-[110px] w-[110px] items-center justify-center rounded-2xl border-2 border-dashed border-border bg-soft"
            >
              <ImagePlus size={22} color="#71717a" />
              <Text className="mt-1 text-[10.5px] font-semibold text-muted">
                เพิ่มรูป
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View className="mx-5 mt-4 flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onPress={pickFromGallery}
            disabled={photos.length >= MAX_PHOTOS}
          >
            <View className="flex-row items-center gap-1.5">
              <ImagePlus size={15} color="#27272a" />
              <Text className="text-[13px] font-semibold text-fg">
                เลือกจากแกลเลอรี
              </Text>
            </View>
          </Button>
          <Button
            className="flex-1"
            onPress={snapPhoto}
            disabled={photos.length >= MAX_PHOTOS}
          >
            <View className="flex-row items-center gap-1.5">
              <Camera size={15} color="#fff" />
              <Text className="text-[13px] font-semibold text-white">
                ถ่ายเพิ่ม
              </Text>
            </View>
          </Button>
        </View>

        <View className="mx-5 mt-5">
          <Text className="text-[11.5px] text-muted">
            อัปแล้ว {photos.length}/{MAX_PHOTOS} รูป · แนะนำ ~{SUGGESTED_PER_PHOTO} ใบเสร็จต่อรูปเพื่อให้ AI อ่านได้ชัด
          </Text>
          <Button
            className="mt-3"
            onPress={() => scanMutation.mutate()}
            disabled={photos.length === 0 || scanMutation.isPending}
          >
            {scanMutation.isPending ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#fff" />
                <Text className="text-[14px] font-semibold text-white">
                  AI กำลังอ่าน...
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <Sparkles size={16} color="#fff" />
                <Text className="text-[14px] font-semibold text-white">
                  เริ่มสแกน ({photos.length} รูป)
                </Text>
              </View>
            )}
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}

function ReviewView({
  scanResult,
  photos,
  decisions,
  setDecisions,
  applying,
  onApply,
  onReset,
}: {
  scanResult: ScanResponse;
  photos: PhotoFile[];
  decisions: Record<string, Decision>;
  setDecisions: React.Dispatch<
    React.SetStateAction<Record<string, Decision>>
  >;
  applying: boolean;
  onApply: () => void;
  onReset: () => void;
}) {
  const grouped = useMemo(() => {
    const auto = scanResult.matches.filter((m) => m.status === "auto");
    const review = scanResult.matches.filter((m) => m.status === "review");
    const unmatched = scanResult.matches.filter(
      (m) => m.status === "unmatched",
    );
    return { auto, review, unmatched };
  }, [scanResult.matches]);

  const approvedCount = Object.values(decisions).filter(
    (d) => d.kind === "approve",
  ).length;

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        {/* Summary card */}
        <View className="mx-5 mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
          <View className="flex-row items-start gap-2">
            <CheckCircle2 size={18} color="#047857" />
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-emerald-900">
                พบใบเสร็จ {scanResult.matches.length} ใบ
              </Text>
              <Text className="mt-1 text-[12.5px] leading-relaxed text-emerald-800">
                จับคู่อัตโนมัติ <Text className="font-bold">{grouped.auto.length}</Text> ·
                ต้องตรวจ <Text className="font-bold">{grouped.review.length}</Text> ·
                ไม่เจอคู่ <Text className="font-bold">{grouped.unmatched.length}</Text>
                {scanResult.duplicates.length > 0
                  ? `\nซ้ำ ${scanResult.duplicates.length} ใบ (จะข้าม)`
                  : ""}
              </Text>
            </View>
          </View>
        </View>

        {grouped.auto.length > 0 ? (
          <Section title={`จับคู่อัตโนมัติ · ${grouped.auto.length} รายการ`} tone="emerald">
            {grouped.auto.map((m) => (
              <ReceiptRow
                key={m.trackingNumber}
                match={m}
                photos={photos}
                candidatePool={scanResult.candidatePool}
                decision={decisions[m.trackingNumber]}
                onChange={(d) =>
                  setDecisions((p) => ({ ...p, [m.trackingNumber]: d }))
                }
              />
            ))}
          </Section>
        ) : null}

        {grouped.review.length > 0 ? (
          <Section title={`ต้องตรวจ · ${grouped.review.length} รายการ`} tone="amber">
            {grouped.review.map((m) => (
              <ReceiptRow
                key={m.trackingNumber}
                match={m}
                photos={photos}
                candidatePool={scanResult.candidatePool}
                decision={decisions[m.trackingNumber]}
                onChange={(d) =>
                  setDecisions((p) => ({ ...p, [m.trackingNumber]: d }))
                }
              />
            ))}
          </Section>
        ) : null}

        {grouped.unmatched.length > 0 ? (
          <Section title={`ไม่เจอคู่ · ${grouped.unmatched.length} รายการ`} tone="zinc">
            {grouped.unmatched.map((m) => (
              <ReceiptRow
                key={m.trackingNumber}
                match={m}
                photos={photos}
                candidatePool={scanResult.candidatePool}
                decision={decisions[m.trackingNumber]}
                onChange={(d) =>
                  setDecisions((p) => ({ ...p, [m.trackingNumber]: d }))
                }
              />
            ))}
          </Section>
        ) : null}
      </ScrollView>

      {/* Sticky bottom bar */}
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-white px-4 py-3"
        style={{ paddingBottom: 24 }}
      >
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-[13px] text-fg">
            จะอัปเดต <Text className="font-bold">{approvedCount}</Text> ออเดอร์
          </Text>
          <Button variant="outline" size="sm" onPress={onReset}>
            <View className="flex-row items-center gap-1.5">
              <X size={14} color="#27272a" />
              <Text className="text-[12.5px] font-semibold text-fg">
                สแกนใหม่
              </Text>
            </View>
          </Button>
          <Button
            size="sm"
            onPress={onApply}
            disabled={approvedCount === 0 || applying}
          >
            {applying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View className="flex-row items-center gap-1.5">
                <CheckCircle2 size={14} color="#fff" />
                <Text className="text-[12.5px] font-semibold text-white">
                  ใช้งานจริง
                </Text>
              </View>
            )}
          </Button>
        </View>
      </View>
    </Screen>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "emerald" | "amber" | "zinc";
  children: React.ReactNode;
}) {
  const bg =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/40"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50/40"
        : "border-border bg-white";
  return (
    <View className={`mx-5 mt-4 rounded-3xl border ${bg} p-3`}>
      <Text className="text-[12px] font-bold text-fg">{title}</Text>
      <View className="mt-2 gap-2">{children}</View>
    </View>
  );
}

function ReceiptRow({
  match,
  photos,
  candidatePool,
  decision,
  onChange,
}: {
  match: MatchedReceipt;
  photos: PhotoFile[];
  candidatePool: CandidateOrder[];
  decision: Decision | undefined;
  onChange: (d: Decision) => void;
}) {
  const [expanded, setExpanded] = useState(match.status !== "auto");
  const photo = photos[match.photoIndex];
  const approvedOrderId =
    decision?.kind === "approve" ? decision.orderId : null;
  const isAuto = match.status === "auto";

  return (
    <View className="rounded-2xl border border-border bg-white p-3">
      <View className="flex-row gap-3">
        {photo ? (
          <View className="h-20 w-20 overflow-hidden rounded-xl bg-soft">
            <CroppedPhoto src={photo.uri} bbox={match.bbox} />
          </View>
        ) : null}
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text className="font-mono text-[12.5px] font-bold text-fg">
              {match.trackingNumber}
            </Text>
            {match.courier ? (
              <View className="rounded-full bg-zinc-100 px-1.5 py-0.5">
                <Text className="text-[9.5px] font-semibold text-zinc-700">
                  {courierLabel(match.courier)}
                </Text>
              </View>
            ) : null}
            {match.labelPaired ? (
              <View className="rounded-full bg-rose-100 px-1.5 py-0.5">
                <Text className="text-[9.5px] font-bold text-rose-800">
                  💎 paired
                </Text>
              </View>
            ) : null}
            {match.confidence === "low" ? (
              <View className="flex-row items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5">
                <AlertCircle size={9} color="#92400e" />
                <Text className="text-[9.5px] font-semibold text-amber-800">
                  AI ไม่มั่นใจ
                </Text>
              </View>
            ) : null}
          </View>
          {match.receiverName ? (
            <Text className="mt-1 text-[11.5px] text-zinc-600">
              AI อ่านชื่อ: {match.receiverName}
            </Text>
          ) : (
            <Text className="mt-1 text-[11.5px] text-amber-700">
              ใบเสร็จไม่มีชื่อผู้รับ
            </Text>
          )}
          {match.postcode ? (
            <Text className="text-[11.5px] text-zinc-600">
              รหัสไปรษณีย์: {match.postcode}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Chosen / picker section */}
      <View className="mt-3">
        {isAuto && match.candidates[0] && !expanded ? (
          <ChosenSummary
            order={candidatePool.find(
              (c) => c.orderId === match.candidates[0].orderId,
            )}
            score={match.candidates[0].score}
            approved={approvedOrderId === match.candidates[0].orderId}
            onToggleApprove={() =>
              onChange(
                approvedOrderId === match.candidates[0].orderId
                  ? { kind: "skip" }
                  : { kind: "approve", orderId: match.candidates[0].orderId },
              )
            }
            onExpand={() => setExpanded(true)}
          />
        ) : (
          <Picker
            match={match}
            candidatePool={candidatePool}
            decision={decision}
            onChange={onChange}
            onCollapse={isAuto ? () => setExpanded(false) : undefined}
          />
        )}
      </View>
    </View>
  );
}

function ChosenSummary({
  order,
  score,
  approved,
  onToggleApprove,
  onExpand,
}: {
  order: CandidateOrder | undefined;
  score: number;
  approved: boolean;
  onToggleApprove: () => void;
  onExpand: () => void;
}) {
  if (!order) return null;
  return (
    <View
      className={`rounded-xl border p-2.5 ${
        approved ? "border-emerald-200 bg-emerald-50" : "border-border bg-white"
      }`}
    >
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <Text className="text-[12.5px] font-semibold text-fg">
            {order.customerName}
            <Text className="text-[10px] font-normal text-emerald-700">
              {" "}({score}% match)
            </Text>
          </Text>
          {order.customerAddress ? (
            <Text
              numberOfLines={2}
              className="mt-0.5 text-[10.5px] text-muted"
            >
              {order.customerAddress}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onToggleApprove}
          className={`rounded-full px-3 py-1 ${
            approved ? "bg-emerald-600" : "border border-border bg-white"
          }`}
        >
          <Text
            className={`text-[11px] font-bold ${
              approved ? "text-white" : "text-fg"
            }`}
          >
            {approved ? "✓ จะอัปเดต" : "เลือก"}
          </Text>
        </Pressable>
      </View>
      <Pressable onPress={onExpand} className="mt-1.5 flex-row items-center gap-1">
        <Text className="text-[10.5px] text-zinc-500 underline">เปลี่ยน</Text>
        <ChevronDown size={11} color="#71717a" />
      </Pressable>
    </View>
  );
}

function Picker({
  match,
  candidatePool,
  decision,
  onChange,
  onCollapse,
}: {
  match: MatchedReceipt;
  candidatePool: CandidateOrder[];
  decision: Decision | undefined;
  onChange: (d: Decision) => void;
  onCollapse?: () => void;
}) {
  const [showRest, setShowRest] = useState(false);
  const approvedOrderId =
    decision?.kind === "approve" ? decision.orderId : null;
  const topCandidateIds = new Set(match.candidates.map((c) => c.orderId));
  const top = match.candidates
    .map((c) => candidatePool.find((p) => p.orderId === c.orderId))
    .filter((c): c is CandidateOrder => Boolean(c));
  const rest = candidatePool.filter((c) => !topCandidateIds.has(c.orderId));

  return (
    <View className="gap-1.5">
      {top.length > 0 ? (
        <Text className="text-[10px] font-bold uppercase tracking-wider text-muted">
          ตัวเลือกที่น่าจะใช่
        </Text>
      ) : null}
      {top.map((c, i) => (
        <CandidateRow
          key={c.orderId}
          order={c}
          score={match.candidates[i]?.score ?? 0}
          selected={approvedOrderId === c.orderId}
          onSelect={() => onChange({ kind: "approve", orderId: c.orderId })}
        />
      ))}
      <Pressable
        onPress={() => setShowRest((s) => !s)}
        className="mt-1 flex-row items-center gap-1 rounded-xl border border-dashed border-border px-3 py-2"
      >
        <Text className="flex-1 text-[11px] font-semibold text-zinc-600">
          เลือกออเดอร์อื่น ({rest.length})
        </Text>
        {showRest ? (
          <ChevronUp size={13} color="#71717a" />
        ) : (
          <ChevronDown size={13} color="#71717a" />
        )}
      </Pressable>
      {showRest ? (
        <View className="gap-1.5">
          {rest.map((c) => (
            <CandidateRow
              key={c.orderId}
              order={c}
              score={0}
              selected={approvedOrderId === c.orderId}
              onSelect={() => onChange({ kind: "approve", orderId: c.orderId })}
            />
          ))}
        </View>
      ) : null}
      <View className="mt-1 flex-row items-center gap-2">
        {approvedOrderId ? (
          <Pressable onPress={() => onChange({ kind: "skip" })}>
            <Text className="text-[10.5px] text-zinc-500 underline">
              ยกเลิกการเลือก
            </Text>
          </Pressable>
        ) : (
          <Text className="text-[10.5px] text-zinc-500">
            ข้ามรายการนี้ — ไม่อัปเดต
          </Text>
        )}
        {onCollapse ? (
          <Pressable
            onPress={onCollapse}
            className="ml-auto flex-row items-center gap-0.5"
          >
            <Text className="text-[10.5px] text-zinc-500 underline">ย่อ</Text>
            <ChevronUp size={11} color="#71717a" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function CandidateRow({
  order,
  score,
  selected,
  onSelect,
}: {
  order: CandidateOrder;
  score: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      className={`flex-row items-start gap-2 rounded-xl border px-2.5 py-2 ${
        selected
          ? "border-rose-300 bg-rose-50"
          : "border-zinc-200 bg-white"
      }`}
    >
      <View
        className={`mt-0.5 size-3.5 items-center justify-center rounded-full border-2 ${
          selected ? "border-rose-600 bg-rose-600" : "border-zinc-300"
        }`}
      >
        {selected ? <View className="size-1.5 rounded-full bg-white" /> : null}
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-[12px] font-semibold text-fg">
          {order.customerName}
          {score > 0 ? (
            <Text className="text-[10px] font-normal text-muted">
              {" "}· {score}%
            </Text>
          ) : null}
        </Text>
        {order.customerAddress ? (
          <Text numberOfLines={1} className="text-[10.5px] text-muted">
            {order.customerAddress}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Crop region of a photo via image transform — Claude bbox is best-effort
 *  so we pad 8% each side to stay safe. */
function CroppedPhoto({
  src,
  bbox,
}: {
  src: string;
  bbox: [number, number, number, number] | null;
}) {
  if (!bbox) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
      />
    );
  }
  const [x1, y1, x2, y2] = bbox;
  const padX = 0.08;
  const padY = 0.08;
  const cx1 = Math.max(0, x1 - padX);
  const cy1 = Math.max(0, y1 - padY);
  const cx2 = Math.min(1, x2 + padX);
  const cy2 = Math.min(1, y2 + padY);
  const w = cx2 - cx1;
  const h = cy2 - cy1;
  const scale = 1 / Math.min(w, h);
  const centerX = (cx1 + cx2) / 2;
  const centerY = (cy1 + cy2) / 2;
  const translateX = (0.5 - centerX) * 100 * scale;
  const translateY = (0.5 - centerY) * 100 * scale;
  return (
    <View style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Image
        source={{ uri: src }}
        style={{
          width: "100%",
          height: "100%",
          transform: [
            { translateX: `${translateX}%` as unknown as number },
            { translateY: `${translateY}%` as unknown as number },
            { scale },
          ],
        }}
        contentFit="cover"
      />
    </View>
  );
}

function courierLabel(code: string): string {
  switch (code) {
    case "FLASH":
      return "Flash";
    case "KERRY":
      return "Kerry";
    case "JT":
      return "J&T";
    case "THAIPOST":
      return "ไปรษณีย์ไทย";
    case "SCG":
      return "SCG";
    case "BEST":
      return "BEST";
    case "NINJAVAN":
      return "Ninjavan";
    case "DHL":
      return "DHL";
    default:
      return "อื่นๆ";
  }
}
