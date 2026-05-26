import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Linking } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { TabBar } from "@/components/ui/tab-bar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getAuthToken, clearAuthToken } from "@/lib/auth";
import { unregisterPushToken } from "@/lib/push";
import { useSellerMode } from "@/store/seller-mode";

export default function MeScreen() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const queryClient = useQueryClient();
  const setMode = useSellerMode((s) => s.setMode);

  useEffect(() => {
    void getAuthToken().then((t) => setAuthed(Boolean(t)));
  }, []);

  const profileQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me.profile(),
    enabled: authed === true,
  });

  // Surface the seller toggle only when the user actually owns shops —
  // otherwise the UI is just noise for pure buyers.
  const ownedShopsQuery = useQuery({
    queryKey: ["me", "shops"],
    queryFn: () => api.me.shops(),
    enabled: authed === true,
    staleTime: 60_000,
  });
  const hasShops = (ownedShopsQuery.data?.shops.length ?? 0) > 0;

  async function handleLogout() {
    Alert.alert("ออกจากระบบ", "ยืนยันออกจากบัญชีนี้?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ออก",
        style: "destructive",
        onPress: async () => {
          await unregisterPushToken();
          await clearAuthToken();
          queryClient.clear();
          setAuthed(false);
        },
      },
    ]);
  }

  if (authed === null) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
        <TabBar active="me" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-10 pb-4">
          <Text className="text-[24px] font-bold text-fg">ฉัน</Text>
        </View>

        {!authed ? (
          <View className="mx-5 rounded-3xl border border-border bg-white p-6">
            <Text className="text-[15px] font-semibold text-fg">
              เข้าสู่ระบบเพื่อใช้งานเต็มรูปแบบ
            </Text>
            <Text className="mt-1 text-[12px] text-muted">
              บันทึกที่อยู่ ติดตามร้าน รับ push เมื่อออเดอร์อัปเดต
            </Text>
            <Button className="mt-4" onPress={() => router.push("/signin?redirect=/me")}>
              เข้าสู่ระบบด้วย LINE
            </Button>
          </View>
        ) : profileQuery.isLoading ? (
          <View className="py-12">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : profileQuery.data ? (
          <>
            {/* Profile card */}
            <View className="mx-5 flex-row items-center gap-3 rounded-3xl border border-border bg-white p-5">
              <View className="size-14 overflow-hidden rounded-full bg-brand-100">
                {profileQuery.data.image ? (
                  <Image
                    source={{ uri: profileQuery.data.image }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="size-full items-center justify-center">
                    <Text className="text-xl font-bold text-brand-700">
                      {profileQuery.data.name?.slice(0, 1) ??
                        profileQuery.data.email.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-semibold text-fg" numberOfLines={1}>
                  {profileQuery.data.name ?? "ผู้ใช้ SalePage"}
                </Text>
                <Text className="text-[12px] text-muted" numberOfLines={1}>
                  {profileQuery.data.email}
                </Text>
              </View>
            </View>

            {/* Stats */}
            <View className="mx-5 mt-3 flex-row gap-2">
              <Stat label="คำสั่งซื้อ" value={profileQuery.data.orderCount} />
              <Stat label="ติดตาม" value={profileQuery.data.followingCount} />
              <Stat label="ถูกใจ" value={profileQuery.data.favoriteCount} />
            </View>
          </>
        ) : null}

        {/* Authenticated user settings — only visible while signed in */}
        {authed ? (
          <>
            {/* Seller mode toggle — only shows when user actually owns ≥1 shop */}
            {hasShops ? (
              <Pressable
                onPress={() => {
                  setMode("seller");
                  router.push("/seller");
                }}
                className="mx-5 mt-4 flex-row items-center gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4"
              >
                <Text className="text-[28px]">🏪</Text>
                <View className="flex-1">
                  <Text className="text-[14px] font-semibold text-amber-900">
                    เปิดโหมดผู้ขาย
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-amber-700">
                    จัดการ {ownedShopsQuery.data!.shops.length} ร้าน · ตรวจสลิป · จัดส่ง
                  </Text>
                </View>
                <Text className="text-[18px] text-amber-700">›</Text>
              </Pressable>
            ) : null}

            <View className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white">
              <MenuItem
                label="คำสั่งซื้อของฉัน"
                onPress={() => router.push("/orders")}
              />
              <MenuItem
                label="กระเป๋าสะสมแต้ม"
                onPress={() => router.push("/me/wallet")}
              />
              <MenuItem
                label="รายได้แอฟฟิลิเอต"
                onPress={() => router.push("/me/earnings")}
              />
              <MenuItem
                label="สมุดที่อยู่"
                onPress={() => router.push("/me/addresses")}
              />
              <MenuItem
                label="การแจ้งเตือนรายร้าน"
                onPress={() => router.push("/me/notifications")}
              />
              <MenuItem
                label="ยืนยันตัวตน (KYC)"
                onPress={() => router.push("/me/kyc")}
              />
            </View>
          </>
        ) : null}

        {/* Power-user shortcuts (V0.5 launcher functions retained) */}
        <View className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white">
          <MenuItem
            label="เปิดร้านด้วย slug"
            onPress={() => {
              Alert.prompt?.(
                "เปิดร้าน",
                "ใส่ slug ร้าน (เช่น nornnao)",
                (slug) => {
                  if (slug && slug.trim()) router.push(`/s/${slug.trim()}`);
                },
              ) ??
                Alert.alert(
                  "เปิดร้าน",
                  "ฟีเจอร์นี้ใน Android: ใส่ใน address bar ของเบราว์เซอร์ — salepage.in.th/<slug>",
                );
            }}
          />
          <MenuItem
            label="ติดตามด้วยรหัสคำสั่งซื้อ"
            onPress={() => {
              Alert.prompt?.(
                "ติดตามคำสั่งซื้อ",
                "ใส่รหัสที่ได้จากอีเมล",
                (token) => {
                  if (token && token.trim()) router.push(`/o/${token.trim()}`);
                },
              ) ??
                Alert.alert("ติดตามคำสั่งซื้อ", "ดูจากอีเมลแล้วเปิดลิงก์ได้เลย");
            }}
          />
          <MenuItem
            label="เปิด Dashboard (เจ้าของร้าน)"
            onPress={() => Linking.openURL("https://salepage.in.th/dashboard")}
          />
        </View>

        <View className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white">
          <MenuItem
            label="เงื่อนไขการใช้งาน"
            onPress={() => Linking.openURL("https://salepage.in.th/terms")}
          />
          <MenuItem
            label="นโยบายความเป็นส่วนตัว"
            onPress={() => Linking.openURL("https://salepage.in.th/privacy")}
          />
          <MenuItem
            label="ติดต่อทีมงาน"
            onPress={() => Linking.openURL("https://salepage.in.th/contact")}
          />
        </View>

        {authed ? (
          <View className="mx-5 mt-4">
            <Button variant="outline" onPress={handleLogout}>
              ออกจากระบบ
            </Button>
          </View>
        ) : null}
      </ScrollView>

      <TabBar active="me" />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 rounded-2xl border border-border bg-white p-4">
      <Text className="text-[11px] uppercase tracking-wider text-muted">{label}</Text>
      <Text className="mt-1 text-[20px] font-bold text-fg">{value}</Text>
    </View>
  );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between border-t border-border px-4 py-3.5 first:border-0"
    >
      <Text className="text-[14px] text-fg">{label}</Text>
      <Text className="text-muted">›</Text>
    </Pressable>
  );
}
