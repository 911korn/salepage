import { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Check } from "lucide-react-native";
import { Button } from "@/components/ui/button";

/**
 * Cancel confirmation bottom-sheet.
 *
 * Replaces the previous Alert.alert(...) flow on /checkout/[token] so a
 * destructive "cancel order" tap isn't possible by accident (911korn
 * 2026-05-27: "การกดยกเลิก Order ควรยากหน่อย มีปุ่มให้ยืนยัน และ อธิบาย").
 * The sheet lists three consequences, offers a radio reason picker so the
 * server can learn what's driving cancels, and stacks "เก็บออเดอร์ไว้"
 * (outline, top) above the destructive "ยกเลิกออเดอร์" (rose, bottom) —
 * inverting the usual button order makes accidental thumb-stays less
 * likely to commit.
 */

export type CancelReason =
  | "wrong-address"
  | "wrong-product"
  | "changed-mind"
  | "other";

const REASONS: { value: CancelReason; label: string }[] = [
  { value: "wrong-address", label: "พิมพ์ที่อยู่ผิด" },
  { value: "wrong-product", label: "เลือกของผิด/ผิดจำนวน" },
  { value: "changed-mind", label: "เปลี่ยนใจ ไม่ต้องการแล้ว" },
  { value: "other", label: "อื่นๆ" },
];

const CONSEQUENCES = [
  "Order นี้จะถูกย้ายไปแท็บ \"ยกเลิก\" ในหน้า Orders ของคุณ",
  "หากคุณโอนเงินไปแล้ว ต้องติดต่อร้านโดยตรงเพื่อขอเงินคืน — แพลตฟอร์มไม่ได้ถือเงิน",
  "ส่งสลิปเพื่อยืนยันการชำระเงินหลังจากนี้ไม่ได้อีก",
];

interface Props {
  visible: boolean;
  pending: boolean;
  onConfirm: (reason: CancelReason) => void;
  onDismiss: () => void;
}

export function CancelConfirmSheet({
  visible,
  pending,
  onConfirm,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<CancelReason>("changed-mind");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* Backdrop — tap outside to dismiss. */}
      <Pressable
        onPress={pending ? undefined : onDismiss}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        {/* Sheet itself. Stop propagation so taps inside don't dismiss. */}
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: "#ffffff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 16,
            paddingBottom: insets.bottom + 16,
            maxHeight: "90%",
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#e4e4e7",
              marginBottom: 12,
            }}
          />
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View className="flex-row items-center gap-2">
              <View className="size-9 items-center justify-center rounded-full bg-rose-50">
                <AlertTriangle size={18} color="#e11d48" strokeWidth={2.4} />
              </View>
              <Text className="flex-1 text-[18px] font-bold text-fg">
                ต้องการยกเลิกออเดอร์นี้?
              </Text>
            </View>

            {/* Consequences list */}
            <View className="mt-4 gap-2.5 rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
              {CONSEQUENCES.map((line) => (
                <View key={line} className="flex-row gap-2">
                  <Text className="mt-[2px] text-[11px] text-rose-600">●</Text>
                  <Text className="flex-1 text-[13px] leading-relaxed text-fg">
                    {line}
                  </Text>
                </View>
              ))}
            </View>

            {/* Reason picker */}
            <Text className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              เหตุผลที่ยกเลิก (ช่วยให้เราดูแลคุณได้ดีขึ้น)
            </Text>
            <View className="mt-2 gap-2">
              {REASONS.map((r) => {
                const isSelected = reason === r.value;
                return (
                  <Pressable
                    key={r.value}
                    onPress={() => setReason(r.value)}
                    disabled={pending}
                    className={`flex-row items-center gap-3 rounded-2xl border px-3.5 py-3 ${
                      isSelected
                        ? "border-brand-300 bg-brand-50"
                        : "border-border bg-white"
                    }`}
                  >
                    <View
                      className={`size-5 items-center justify-center rounded-full border-2 ${
                        isSelected
                          ? "border-brand-600 bg-brand-600"
                          : "border-zinc-300 bg-white"
                      }`}
                    >
                      {isSelected ? (
                        <Check size={12} color="#ffffff" strokeWidth={3} />
                      ) : null}
                    </View>
                    <Text
                      className={`flex-1 text-[14px] ${
                        isSelected
                          ? "font-semibold text-brand-700"
                          : "text-fg"
                      }`}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Action buttons — outline-keep ON TOP, destructive-cancel
                BELOW. This inverts the default order on purpose; a user
                whose thumb is still resting after a mis-tap is much more
                likely to land on the safe option. */}
            <View className="mt-6 gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onPress={onDismiss}
              >
                เก็บออเดอร์ไว้ (กดผิด)
              </Button>
              <Pressable
                onPress={() => onConfirm(reason)}
                disabled={pending}
                className={`items-center justify-center rounded-2xl px-4 py-3 ${
                  pending ? "bg-rose-300" : "bg-rose-600"
                }`}
              >
                {pending ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-[15px] font-semibold text-white">
                    ยืนยันการยกเลิกออเดอร์
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
