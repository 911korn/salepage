import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share as RNShare,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

/**
 * /me/addresses — read-only address book derived from past orders.
 *
 * V1.5 limits: we don't allow editing the address text here (that would
 * require a `UserAddress` table — deferred to V1.6). Tapping an address
 * copies it via the native share sheet so the user can paste it into the
 * next checkout form.
 *
 * If/when the cart screen gains "เลือกจากที่อยู่ที่เคยใช้" this screen
 * stays useful as the canonical list + history.
 */
export default function AddressBookScreen() {
  const addrQuery = useQuery({
    queryKey: ["me", "addresses"],
    queryFn: () => api.me.addresses(),
  });

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-16">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            สมุดที่อยู่
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            ที่อยู่ที่เคยใช้
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            รวบรวมจากคำสั่งซื้อล่าสุดของคุณ {"\n"}แตะที่อยู่เพื่อคัดลอกใช้ในการสั่งครั้งหน้า
          </Text>
        </View>

        {addrQuery.isLoading ? (
          <View className="py-16">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : addrQuery.data?.addresses.length === 0 ? (
          <View className="mx-5 mt-8 items-center rounded-3xl border border-dashed border-border p-8">
            <Text className="text-[28px]">📍</Text>
            <Text className="mt-2 text-[14px] font-semibold text-fg">
              ยังไม่มีที่อยู่บันทึก
            </Text>
            <Text className="mt-1 text-center text-[11px] text-muted">
              ที่อยู่จะถูกบันทึกอัตโนมัติเมื่อสั่งซื้อครั้งแรก
            </Text>
            <Button
              variant="outline"
              className="mt-4"
              onPress={() => router.replace("/")}
            >
              เริ่มช็อปปิ้ง
            </Button>
          </View>
        ) : (
          <View className="mt-4 gap-3 px-5">
            {addrQuery.data?.addresses.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => {
                  // Native Share is the most portable "copy to clipboard"
                  // primitive across iOS + Android without adding another dep.
                  void RNShare.share({ message: a.address });
                }}
                className="overflow-hidden rounded-2xl border border-border bg-white"
              >
                <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-fg" numberOfLines={1}>
                      {a.name}
                    </Text>
                    {a.phone ? (
                      <Text className="mt-0.5 text-[11px] text-muted">
                        {a.phone}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="text-[10px] text-muted">
                    ใช้กับร้าน {a.lastShop.name}
                  </Text>
                </View>
                <View className="p-4">
                  <Text className="text-[12px] leading-relaxed text-fg">
                    {a.address}
                  </Text>
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-[10px] text-muted">
                      ครั้งล่าสุด{" "}
                      {new Date(a.lastUsedAt).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                    <Text className="text-[11px] font-semibold text-brand-700">
                      แตะเพื่อคัดลอก →
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
