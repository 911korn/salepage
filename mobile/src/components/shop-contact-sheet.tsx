import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Phone, MessageCircle, Globe, X } from "lucide-react-native";

/**
 * Contact-seller bottom-sheet.
 *
 * Buyers reach out to shops DIRECTLY on SalePage — the platform doesn't
 * broker conversations like Shopee (911korn 2026-05-27: "หน้านี้ควรมี
 * ปุ่ม ติดต่อผู้ขาย ไว้ให้ลูกค้าด้วย เพราะเราไม่ได้เป็นเหมือน Shopee").
 * The sheet lists every contact method the shop configured in
 * `shop.contact` (phone / LINE / Facebook); each row taps through to the
 * relevant app via `Linking.openURL` so the buyer can ping the seller to
 * follow up on shipment.
 */
export type ShopContact = {
  phone?: string | null;
  line?: string | null;
  facebook?: string | null;
} | null;

interface Props {
  visible: boolean;
  shopName: string;
  contact: ShopContact;
  onDismiss: () => void;
}

export function ShopContactSheet({
  visible,
  shopName,
  contact,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const phone = contact?.phone?.trim();
  const lineId = contact?.line?.trim();
  const facebook = contact?.facebook?.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: "#ffffff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            maxHeight: "85%",
          }}
        >
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
          <View className="flex-row items-center justify-between px-5">
            <View className="flex-1">
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                ติดต่อผู้ขาย
              </Text>
              <Text className="mt-0.5 text-[18px] font-bold text-fg" numberOfLines={1}>
                {shopName}
              </Text>
            </View>
            <Pressable
              onPress={onDismiss}
              hitSlop={8}
              className="size-9 items-center justify-center rounded-full bg-soft"
              accessibilityLabel="Close"
            >
              <X size={18} color="#0a0a0a" strokeWidth={2.4} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {phone ? (
              <ContactRow
                icon={<Phone size={20} color="#e11d48" strokeWidth={2.2} />}
                label="โทรหาผู้ขาย"
                value={phone}
                onPress={() => openLink(`tel:${phone.replace(/[^\d+]/g, "")}`)}
              />
            ) : null}
            {lineId ? (
              <ContactRow
                icon={<MessageCircle size={20} color="#06C755" strokeWidth={2.2} />}
                label="LINE"
                value={lineId}
                onPress={() => openLink(buildLineUrl(lineId))}
              />
            ) : null}
            {facebook ? (
              <ContactRow
                icon={<Globe size={20} color="#1877F2" strokeWidth={2.2} />}
                label="Facebook"
                value={facebook}
                onPress={() => openLink(buildFacebookUrl(facebook))}
              />
            ) : null}
            {!phone && !lineId && !facebook ? (
              <View className="rounded-2xl border border-dashed border-border bg-soft/40 p-5">
                <Text className="text-center text-[13px] text-muted">
                  ผู้ขายยังไม่ได้ใส่ข้อมูลติดต่อ — ลองรีเฟรชสถานะออเดอร์
                  หรือเปิดข้อพิพาทเพื่อให้ทีมงานช่วยตามให้
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ContactRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      className="mb-2 flex-row items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3"
    >
      <View className="size-10 items-center justify-center rounded-full bg-soft">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-[12px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </Text>
        <Text className="mt-0.5 text-[14px] font-medium text-fg" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

function buildLineUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Strip leading @, then route through LINE's universal add-friend URL.
  // Both personal LINE IDs and OA IDs are accepted — @salepage-style OA
  // accounts route through ti/p/~ as well.
  const id = trimmed.replace(/^@/, "");
  return `https://line.me/R/ti/p/@${id}`;
}

function buildFacebookUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Accept either a username, a numeric page id, or a "facebook.com/..." path
  const handle = trimmed
    .replace(/^@/, "")
    .replace(/^facebook\.com\//i, "")
    .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "");
  return `https://facebook.com/${handle}`;
}

async function openLink(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("เปิดลิงก์ไม่ได้", `อุปกรณ์นี้ไม่รองรับ:\n${url}`);
      return;
    }
    await Linking.openURL(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    Alert.alert("เกิดข้อผิดพลาด", msg);
  }
}
