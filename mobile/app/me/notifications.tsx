import { View, Text, ScrollView, ActivityIndicator, Switch } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

/**
 * /me/notifications — per-shop push notification preferences.
 *
 * Shows every shop the user follows; each row has three switches mapping to
 * the `ShopFollow.notifyNew/Live/Sale` columns. Optimistic updates so the
 * switch responds instantly even on flaky networks.
 */
export default function NotificationPrefsScreen() {
  const qc = useQueryClient();
  const followsQuery = useQuery({
    queryKey: ["me", "following"],
    queryFn: () => api.me.following(),
  });

  const updateMutation = useMutation({
    mutationFn: api.me.updateFollowPrefs,
    onMutate: async (input) => {
      // Optimistic — flip the toggle locally without waiting for the server.
      await qc.cancelQueries({ queryKey: ["me", "following"] });
      const prev = qc.getQueryData<Awaited<ReturnType<typeof api.me.following>>>([
        "me",
        "following",
      ]);
      if (prev) {
        qc.setQueryData(["me", "following"], {
          ...prev,
          follows: prev.follows.map((f) =>
            f.shopId === input.shopId
              ? {
                  ...f,
                  notifyNew: input.notifyNew ?? f.notifyNew,
                  notifyLive: input.notifyLive ?? f.notifyLive,
                  notifySale: input.notifySale ?? f.notifySale,
                }
              : f,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      // Rollback if the server rejected the change.
      if (ctx?.prev) qc.setQueryData(["me", "following"], ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["me", "following"] });
    },
  });

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-16">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            ตั้งค่าการแจ้งเตือน
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            ร้านที่ติดตาม
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            เลือกได้ว่าอยากรับแจ้งเตือนจากร้านไหนบ้าง — ปิดได้ทุกอย่างโดยที่ยังคงติดตามร้านอยู่
          </Text>
        </View>

        {followsQuery.isLoading ? (
          <View className="py-16">
            <ActivityIndicator color="#e11d48" />
          </View>
        ) : followsQuery.data?.follows.length === 0 ? (
          <View className="mx-5 mt-8 items-center rounded-3xl border border-dashed border-border p-8">
            <Text className="text-[14px] font-semibold text-fg">
              ยังไม่ได้ติดตามร้านใด
            </Text>
            <Text className="mt-1 text-center text-[12px] text-muted">
              กดปุ่ม &quot;ติดตาม&quot; ในหน้าร้าน เพื่อรับแจ้งเตือนสินค้าใหม่และโปรโมชั่น
            </Text>
            <Button
              variant="outline"
              className="mt-4"
              onPress={() => router.replace("/")}
            >
              เลือกร้าน
            </Button>
          </View>
        ) : (
          <View className="mt-4 gap-2 px-5">
            {followsQuery.data?.follows.map((f) => (
              <View
                key={f.shopId}
                className="overflow-hidden rounded-2xl border border-border bg-white"
              >
                <View className="flex-row items-center gap-3 p-4">
                  <View
                    className="size-12 items-center justify-center overflow-hidden rounded-xl"
                    style={{ backgroundColor: f.shop.themeColor }}
                  >
                    {f.shop.logoUrl ? (
                      <Image
                        source={{ uri: f.shop.logoUrl }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <Text className="text-[16px] font-bold text-white">
                        {f.shop.logoText ?? f.shop.name.slice(0, 1)}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-[14px] font-semibold text-fg"
                      numberOfLines={1}
                    >
                      {f.shop.name}
                    </Text>
                    {f.shop.category ? (
                      <Text className="mt-0.5 text-[11px] text-muted">
                        {f.shop.category}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View className="border-t border-border bg-soft/30">
                  <PrefRow
                    label="สินค้าใหม่"
                    description="แจ้งเตือนเมื่อร้านเพิ่มสินค้าใหม่"
                    value={f.notifyNew}
                    onValueChange={(v) =>
                      updateMutation.mutate({ shopId: f.shopId, notifyNew: v })
                    }
                  />
                  <PrefRow
                    label="ไลฟ์สด"
                    description="แจ้งเตือนเมื่อร้านเริ่มไลฟ์ขาย (V2)"
                    value={f.notifyLive}
                    onValueChange={(v) =>
                      updateMutation.mutate({ shopId: f.shopId, notifyLive: v })
                    }
                  />
                  <PrefRow
                    label="โปรโมชั่น/คูปอง"
                    description="แฟลชเซลและคูปองใหม่"
                    value={f.notifySale}
                    onValueChange={(v) =>
                      updateMutation.mutate({ shopId: f.shopId, notifySale: v })
                    }
                    isLast
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function PrefRow({
  label,
  description,
  value,
  onValueChange,
  isLast,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3 ${
        isLast ? "" : "border-b border-border"
      }`}
    >
      <View className="flex-1">
        <Text className="text-[13px] font-semibold text-fg">{label}</Text>
        <Text className="mt-0.5 text-[11px] text-muted">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#e5e7eb", true: "#fda4af" }}
        thumbColor={value ? "#e11d48" : "#fafafa"}
      />
    </View>
  );
}
