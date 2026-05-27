import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { safeBack } from "@/lib/safe-back";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";

/**
 * /o/[token]/review — buyer-facing review submission screen.
 *
 * Flow:
 *   1. Read the order to know the shop slug and validate eligibility client-side.
 *   2. Render a 1–5 star tap row (default: 5) + optional textarea (max 2000).
 *   3. POST to `/api/v1/shops/:slug/reviews` with the order token.
 *   4. Server enforces slipVerifiedAt + one-review-per-order; we surface
 *      its error message verbatim.
 */
export default function ReviewScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ["order", token],
    queryFn: () => api.orders.get(token!),
    enabled: Boolean(token),
  });

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!orderQuery.data) throw new Error("ยังโหลดข้อมูลไม่เสร็จ");
      return api.shops.submitReview(orderQuery.data.shop.slug, {
        orderToken: token!,
        rating,
        comment: comment.trim() || undefined,
      });
    },
    onSuccess: () => {
      Alert.alert("ขอบคุณสำหรับรีวิว!", "รีวิวของคุณช่วยให้ผู้อื่นตัดสินใจได้ดีขึ้น", [
        {
          text: "ดูร้าน",
          onPress: () => {
            void queryClient.invalidateQueries({
              queryKey: ["shop", orderQuery.data!.shop.slug, "reviews"],
            });
            router.replace(`/s/${orderQuery.data!.shop.slug}`);
          },
        },
      ]);
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "ส่งรีวิวล้มเหลว";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  if (!token) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-fg">เกิดข้อผิดพลาด</Text>
        </View>
      </Screen>
    );
  }

  if (orderQuery.isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  if (!orderQuery.data) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-fg">ไม่พบคำสั่งซื้อ</Text>
          <Button className="mt-4" variant="outline" onPress={() => safeBack()}>
            ย้อนกลับ
          </Button>
        </View>
      </Screen>
    );
  }

  const order = orderQuery.data;
  const eligible =
    (order.status === "SHIPPING" || order.status === "DELIVERED") &&
    Boolean(order.slipVerifiedAt);

  if (!eligible) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-fg">
            รีวิวได้หลังจากออเดอร์ถูกจัดส่งและสลิปได้รับการยืนยันแล้ว
          </Text>
          <Button className="mt-4" variant="outline" onPress={() => safeBack()}>
            ย้อนกลับ
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            เขียนรีวิว
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            ให้คะแนน {order.shop.name}
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            รีวิวของคุณจะแสดงพร้อมแบดจ์ &quot;✓ verified&quot; เพราะมีสลิปยืนยันแล้ว
          </Text>
        </View>

        {/* Star picker */}
        <View className="mx-5 mt-6 items-center rounded-3xl border border-border bg-white p-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            คะแนน
          </Text>
          <View className="mt-3 flex-row gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setRating(n)}
                className="size-12 items-center justify-center"
              >
                <Text
                  className={`text-[36px] ${
                    n <= rating ? "text-amber-400" : "text-zinc-300"
                  }`}
                >
                  {n <= rating ? "★" : "☆"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="mt-2 text-[14px] font-semibold text-fg">
            {rating === 5
              ? "ยอดเยี่ยม"
              : rating === 4
                ? "ดีมาก"
                : rating === 3
                  ? "ใช้ได้"
                  : rating === 2
                    ? "ปรับปรุง"
                    : "ไม่ดี"}
          </Text>
        </View>

        {/* Comment */}
        <View className="mx-5 mt-4 gap-2">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            ข้อความรีวิว (ไม่จำเป็น)
          </Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="ของส่งเร็ว แพ็คดี ใช้งานได้ตามคำอธิบาย..."
            multiline
            maxLength={2000}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[14px] text-fg"
            style={{ minHeight: 100, textAlignVertical: "top" }}
          />
          <Text className="text-right text-[10px] text-muted">
            {comment.length}/2000
          </Text>
        </View>

        <View className="mx-5 mt-4 rounded-2xl border border-dashed border-border p-4">
          <Text className="text-[11px] leading-relaxed text-muted">
            💡 เคล็ดลับ: เขียนเกี่ยวกับคุณภาพสินค้า ความเร็วในการจัดส่ง
            และการสื่อสารของร้าน — ผู้ซื้อใหม่จะตัดสินใจง่ายขึ้น
          </Text>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white p-4">
        <Button
          disabled={submitMutation.isPending}
          onPress={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? "กำลังส่ง..." : "ส่งรีวิว"}
        </Button>
      </View>
    </Screen>
  );
}
