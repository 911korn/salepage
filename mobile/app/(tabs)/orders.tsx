import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { formatBaht, orderStatusLabel, formatRelativeTime } from "@/lib/format";
import { useEffect, useState } from "react";

export default function OrdersScreen() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    void getAuthToken().then((t) => setAuthed(Boolean(t)));
  }, []);

  const ordersQuery = useQuery({
    queryKey: ["me", "orders"],
    queryFn: () => api.me.orders(),
    enabled: authed === true,
  });

  if (authed === null) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  if (!authed) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-[18px] font-semibold text-fg">
            เข้าสู่ระบบเพื่อดูคำสั่งซื้อทุกร้าน
          </Text>
          <Text className="mt-1 text-center text-[13px] text-muted">
            หรือใช้รหัสติดตามจากอีเมลของคุณ
          </Text>
          <Button className="mt-6" onPress={() => router.push("/signin?redirect=/orders")}>
            เข้าสู่ระบบ
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-10">
          <Text className="text-[24px] font-bold text-fg">คำสั่งซื้อ</Text>
          <Text className="mt-0.5 text-[13px] text-muted">
            รวมทุกร้านที่ใช้อีเมลเดียวกัน
          </Text>
        </View>

        {ordersQuery.isLoading ? (
          <View className="py-12">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : ordersQuery.error ? (
          <ErrorState error={ordersQuery.error} />
        ) : ordersQuery.data?.orders.length === 0 ? (
          <EmptyState />
        ) : (
          <View className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white">
            {ordersQuery.data?.orders.map((o, i) => (
              <Pressable
                key={o.token}
                onPress={() => router.push(`/o/${o.token}`)}
                className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[14px] font-semibold text-fg" numberOfLines={1}>
                    {o.shopName}
                  </Text>
                  <Text className="text-[14px] font-bold text-brand-700">
                    {formatBaht(o.totalSatang)}
                  </Text>
                </View>
                <View className="mt-1 flex-row items-center justify-between">
                  <Text className="text-[12px] text-muted">
                    {orderStatusLabel(o.status)}
                  </Text>
                  <Text className="text-[11px] text-muted">
                    {formatRelativeTime(o.createdAt)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function EmptyState() {
  return (
    <View className="mx-5 mt-6 rounded-3xl border border-dashed border-border bg-white p-8">
      <Text className="text-center text-[15px] font-semibold text-fg">
        ยังไม่มีคำสั่งซื้อ
      </Text>
      <Text className="mt-1 text-center text-[12px] text-muted">
        เริ่มเลือกร้านได้ที่หน้า ค้นพบ
      </Text>
    </View>
  );
}

function ErrorState({ error }: { error: unknown }) {
  const msg =
    error instanceof ApiClientError ? error.message : "โหลดคำสั่งซื้อล้มเหลว";
  return (
    <View className="mx-5 mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6">
      <Text className="text-center text-[14px] text-rose-700">{msg}</Text>
    </View>
  );
}
