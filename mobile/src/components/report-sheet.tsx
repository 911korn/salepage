import { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Flag, X } from "lucide-react-native";
import { api, ApiClientError } from "@/lib/api";

/**
 * Generic report sheet — wired to /api/v1/reports.
 *
 * Apple Guideline 1.2 requires every UGC surface to expose an in-app
 * report flow. Rendered as a controlled modal so any of stories /
 * live comments / reviews / shops / products can `setVisible(true)`
 * + pass the kind + targetId.
 */
type Kind = "SHOP" | "PRODUCT" | "REVIEW" | "STORY" | "LIVE_COMMENT";
type Reason =
  | "SPAM"
  | "INAPPROPRIATE"
  | "COUNTERFEIT"
  | "HARASSMENT"
  | "ILLEGAL"
  | "MISLEADING"
  | "OTHER";

interface Props {
  visible: boolean;
  onClose: () => void;
  kind: Kind;
  targetId: string;
  /** Display name of the content being reported (e.g. shop name) — shown in the header. */
  targetLabel?: string;
}

const REASONS: Array<{ value: Reason; label: string }> = [
  { value: "INAPPROPRIATE", label: "เนื้อหาไม่เหมาะสม / ลามก / รุนแรง" },
  { value: "COUNTERFEIT", label: "ของปลอม / ผิดลิขสิทธิ์" },
  { value: "MISLEADING", label: "หลอกลวง / โฆษณาเกินจริง" },
  { value: "HARASSMENT", label: "คุกคาม / ใช้คำหยาบ" },
  { value: "SPAM", label: "สแปม / ก่อกวน" },
  { value: "ILLEGAL", label: "ผิดกฎหมาย" },
  { value: "OTHER", label: "อื่นๆ (ระบุด้านล่าง)" },
];

export function ReportSheet({ visible, onClose, kind, targetId, targetLabel }: Props) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setReason(null);
    setNote("");
    setSubmitting(false);
  }

  async function submit() {
    if (!reason) return;
    setSubmitting(true);
    try {
      const res = await api.reports.file({
        kind,
        targetId,
        reason,
        note: note.trim() || undefined,
      });
      if (res.alreadyReported) {
        Alert.alert("รับเรื่องไว้แล้ว", "คุณรายงานเนื้อหานี้ไปแล้วเมื่อ 24 ชั่วโมงก่อน ทีมงานกำลังตรวจสอบ");
      } else {
        Alert.alert(
          "ส่งรายงานเรียบร้อย",
          "ขอบคุณที่ช่วยให้ SalePage ปลอดภัย · ทีมงานจะตรวจสอบภายใน 24 ชั่วโมง",
        );
      }
      reset();
      onClose();
    } catch (err) {
      Alert.alert(
        "ส่งรายงานไม่สำเร็จ",
        err instanceof ApiClientError ? err.message : "กรุณาลองใหม่อีกครั้ง",
      );
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/55">
        <View className="rounded-t-3xl bg-white pb-8">
          <View className="flex-row items-start justify-between px-5 pt-4 pb-3">
            <View className="flex-1 pr-2">
              <View className="flex-row items-center gap-2">
                <Flag size={16} color="#e11d48" />
                <Text className="text-[16px] font-bold text-fg">รายงานเนื้อหา</Text>
              </View>
              {targetLabel ? (
                <Text className="mt-0.5 text-[12px] text-muted" numberOfLines={1}>
                  {targetLabel}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="size-8 items-center justify-center rounded-full bg-soft"
            >
              <X size={16} color="#525252" />
            </Pressable>
          </View>

          <View className="border-t border-border px-5 py-4">
            <Text className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              เหตุผล
            </Text>
            <View className="mt-2 gap-1.5">
              {REASONS.map((r) => {
                const active = reason === r.value;
                return (
                  <Pressable
                    key={r.value}
                    onPress={() => setReason(r.value)}
                    className={`flex-row items-center gap-3 rounded-2xl border px-3 py-3 ${
                      active
                        ? "border-brand-300 bg-brand-50"
                        : "border-border bg-white"
                    }`}
                  >
                    <View
                      className={`size-4 rounded-full border-2 ${
                        active ? "border-brand-600 bg-brand-600" : "border-border"
                      }`}
                    />
                    <Text
                      className={`flex-1 text-[13px] ${active ? "font-semibold text-brand-700" : "text-fg"}`}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="mt-4 text-[12px] font-semibold uppercase tracking-wider text-muted">
              รายละเอียดเพิ่มเติม (ไม่บังคับ)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={1000}
              placeholder="อธิบายปัญหาเพิ่มเติม..."
              className="mt-2 rounded-2xl border border-border bg-white px-3 py-2 text-[14px] text-fg"
              style={{ minHeight: 70, textAlignVertical: "top" }}
            />

            <Pressable
              onPress={submit}
              disabled={!reason || submitting}
              className={`mt-4 flex-row items-center justify-center gap-2 rounded-2xl py-3 ${
                !reason || submitting ? "bg-zinc-300" : "bg-brand-600"
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : null}
              <Text className="text-[14px] font-semibold text-white">
                ส่งรายงาน
              </Text>
            </Pressable>
            <Text className="mt-2 text-center text-[11px] leading-relaxed text-muted">
              ทีมงานตรวจสอบภายใน 24 ชั่วโมง · เนื้อหาที่ผิดกฎจะถูกลบทันที
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
