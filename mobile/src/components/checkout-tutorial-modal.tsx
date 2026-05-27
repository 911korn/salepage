import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
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
      <View className="flex-1 bg-black/55 px-4 py-12">
        <View className="mx-auto w-full max-w-md flex-1 overflow-hidden rounded-3xl bg-white shadow-2xl">
          <View className="flex-row items-start justify-between bg-brand-50 px-5 pt-5 pb-4">
            <View className="flex-1 pr-2">
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">
                ครั้งแรกที่สั่ง?
              </Text>
              <Text className="mt-1 text-[20px] font-bold text-fg">
                3 ขั้นตอน เสร็จใน 1 นาที
              </Text>
            </View>
            <Pressable onPress={dismiss} hitSlop={10} className="size-8 items-center justify-center rounded-full bg-white">
              <X size={18} color="#525252" />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="px-5 py-5 gap-4">
            <Step
              num={1}
              icon={Camera}
              title="แคปหน้าจอ QR code"
              body="ใช้นิ้วแคปหน้าจอเก็บ QR PromptPay ไว้ก่อน (กดปุ่ม Power + Volume Up บน iPhone)"
            />
            <Step
              num={2}
              icon={Smartphone}
              title="เปิดแอปธนาคาร · สแกน QR"
              body="ไปแอปธนาคารของคุณ (K Plus / SCB Easy / Krungthai NEXT / ฯลฯ) — เลือก สแกน QR → เลือกรูปที่แคปไว้ → กดยืนยันโอน"
            />
            <Step
              num={3}
              icon={Upload}
              title="กลับมา Upload สลิปที่นี่"
              body="แตะปุ่ม 'สแกน QR บนสลิป' หรือ 'เลือกจากคลังภาพ' ระบบจะอ่านสลิปให้เอง"
            />
            <View className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <View className="flex-row items-center gap-2">
                <Sparkles size={18} color="#059669" />
                <Text className="text-[14px] font-bold text-emerald-900">
                  ทุกอย่างหลังจากนั้น — Auto
                </Text>
              </View>
              <Text className="mt-2 text-[12px] leading-relaxed text-emerald-900">
                ✓ AI ตรวจสลิปใน 3 วินาที{"\n"}
                ✓ ออเดอร์เปลี่ยนเป็น "ชำระแล้ว" ทันที{"\n"}
                ✓ ร้านได้รับแจ้งเตือนเตรียมส่งของ
              </Text>
            </View>

            <View className="flex-row items-center gap-2 rounded-2xl bg-soft p-3">
              <Truck size={18} color="#737373" />
              <Text className="flex-1 text-[12px] leading-relaxed text-muted">
                เงินถึงร้านโดยตรงผ่าน PromptPay · ไม่ผ่านคนกลาง · ไม่หักค่าธรรมเนียม
              </Text>
            </View>
          </ScrollView>

          <View className="border-t border-border px-5 py-4">
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
