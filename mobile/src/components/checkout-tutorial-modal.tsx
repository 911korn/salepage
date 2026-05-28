import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Camera, Smartphone, Upload, Sparkles, Truck, X } from "lucide-react-native";
import { Button } from "@/components/ui/button";

/**
 * First-purchase tutorial. Shown ONCE per device on the checkout / QR
 * page so new buyers don't get lost between "QR appeared" and "where do
 * I actually pay?". Subsequent purchases skip it (AsyncStorage flag).
 *
 * 911korn 2026-05-28: "ตอนที่ลูกค้าได้ qr code หลังจากกดสั่ง Order
 * อยากให้มี Modal สอนวิธี … ให้ขึ้นแค่การซื้อครั้งแรกพอ"
 *
 * Flow displayed:
 *   1. แคป QR
 *   2. เปิดแอปธนาคาร โอนตามยอด
 *   3. กลับมา Upload สลิป
 *   4. AI ตรวจสลิปใน 3 วินาที — Auto ทุกอย่าง
 *   5. ร้านจัดส่งสินค้าให้คุณ
 */
const SEEN_KEY = "salepage:seen-checkout-tutorial";

export function CheckoutTutorialModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(SEEN_KEY);
        if (!seen && !cancelled) setOpen(true);
      } catch {
        // SecureStore / AsyncStorage failure — fail-safe: don't show the
        // modal again, the buyer might be on a sandboxed device.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    setOpen(false);
    void AsyncStorage.setItem(SEEN_KEY, "1").catch(() => undefined);
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      {/* Centered card that sizes to content — no flex-1 on the inner
          view so the modal doesn't stretch to fill the screen (911korn
          2026-05-28 02:17: "อันนี้ใหญ่ไปเอาแค่ครึ่งนึงพอ"). */}
      <View className="flex-1 items-center justify-center bg-black/55 px-4">
        <View className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
          <View className="flex-row items-start justify-between bg-brand-50 px-4 pt-3 pb-3">
            <View className="flex-1 pr-2">
              <Text className="text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                ครั้งแรกที่สั่ง?
              </Text>
              <Text className="mt-0.5 text-[17px] font-bold text-fg">
                3 ขั้นตอน เสร็จใน 1 นาที
              </Text>
            </View>
            <Pressable onPress={dismiss} hitSlop={10} className="size-7 items-center justify-center rounded-full bg-white">
              <X size={16} color="#525252" />
            </Pressable>
          </View>

          <View className="gap-3 px-4 py-4">
            <Step
              num={1}
              icon={Camera}
              title="แคปหน้าจอ QR code"
              body="กด Power + Volume Up บน iPhone เก็บ QR ไว้"
            />
            <Step
              num={2}
              icon={Smartphone}
              title="เปิดแอปธนาคาร · สแกน QR"
              body="K Plus / SCB Easy / NEXT — สแกน QR → เลือกรูปที่แคป → ยืนยันโอน"
            />
            <Step
              num={3}
              icon={Upload}
              title="กลับมา Upload สลิปที่นี่"
              body="แตะ 'สแกน QR บนสลิป' หรือ 'เลือกจากคลังภาพ'"
            />
            <View className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <View className="flex-row items-center gap-1.5">
                <Sparkles size={14} color="#059669" />
                <Text className="text-[12px] font-bold text-emerald-900">
                  หลังจากนั้น Auto ทุกอย่าง
                </Text>
              </View>
              <Text className="mt-1 text-[11px] leading-snug text-emerald-900">
                ✓ AI ตรวจสลิป 3 วิ · ออเดอร์ขึ้น “ชำระแล้ว” · ร้านเตรียมส่งของ
              </Text>
            </View>

            <View className="flex-row items-center gap-2 rounded-xl bg-soft p-2.5">
              <Truck size={14} color="#737373" />
              <Text className="flex-1 text-[11px] leading-snug text-muted">
                เงินถึงร้านตรงผ่าน PromptPay · ไม่ผ่านคนกลาง · ไม่หัก%
              </Text>
            </View>
          </View>

          <View className="border-t border-border px-4 py-3">
            <Button onPress={dismiss}>เริ่มชำระเงิน</Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Step({
  num,
  icon: Icon,
  title,
  body,
}: {
  num: number;
  icon: typeof Camera;
  title: string;
  body: string;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="size-9 items-center justify-center rounded-full bg-brand-600">
        <Text className="text-[14px] font-bold text-white">{num}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Icon size={16} color="#0a0a0a" />
          <Text className="text-[14px] font-bold text-fg">{title}</Text>
        </View>
        <Text className="mt-1 text-[12px] leading-relaxed text-muted">
          {body}
        </Text>
      </View>
    </View>
  );
}
