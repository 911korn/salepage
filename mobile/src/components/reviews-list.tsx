import { View, Text, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Inline reviews list for the mobile shop page. Fetches via
 * `api.shops.reviews(slug)` and renders up to 6 most-recent reviews with a
 * star row, comment, optional shop reply, and a green "✓ verified" pill
 * for slip-verified reviewers.
 *
 * Doesn't include a "post review" CTA — that lives on the order tracking
 * screen so we have the order token in scope.
 */
interface Props {
  slug: string;
  /** Cap how many to render (default 6). */
  limit?: number;
}

export function ReviewsList({ slug, limit = 6 }: Props) {
  const reviewsQuery = useQuery({
    queryKey: ["shop", slug, "reviews"],
    queryFn: () => api.shops.reviews(slug),
  });

  if (reviewsQuery.isLoading) {
    return (
      <View className="py-4">
        <ActivityIndicator color="#e11d48" />
      </View>
    );
  }
  if (!reviewsQuery.data || reviewsQuery.data.reviews.length === 0) {
    return (
      <View className="rounded-2xl border border-dashed border-border p-5">
        <Text className="text-center text-[12px] text-muted">
          ยังไม่มีรีวิว
        </Text>
      </View>
    );
  }

  const { reviews, summary } = reviewsQuery.data;

  return (
    <View>
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[14px] font-bold text-fg">
          ⭐ {summary.averageRating.toFixed(1)} ({summary.totalReviews})
        </Text>
        <Text className="text-[10px] text-muted">เฉพาะรีวิวที่ยืนยันแล้ว</Text>
      </View>

      <View className="mt-2 gap-2">
        {reviews.slice(0, limit).map((r) => (
          <View
            key={r.id}
            className="rounded-2xl border border-border bg-white p-3"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Text className="text-[12px] font-semibold text-fg">
                  {r.customerName}
                </Text>
                {r.verified ? (
                  <View className="rounded-full bg-emerald-50 px-1.5 py-0.5">
                    <Text className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700">
                      ✓ verified
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-[12px] text-amber-500">
                {"★".repeat(r.rating)}
                <Text className="text-zinc-300">
                  {"★".repeat(5 - r.rating)}
                </Text>
              </Text>
            </View>
            {r.comment ? (
              <Text
                className="mt-1.5 text-[12px] leading-relaxed text-fg"
                numberOfLines={4}
              >
                {r.comment}
              </Text>
            ) : null}
            {r.reply ? (
              <View className="mt-2 rounded-lg bg-soft px-2 py-1.5">
                <Text className="text-[10px] font-semibold text-brand-700">
                  ร้านตอบ:
                </Text>
                <Text className="text-[11px] text-fg">{r.reply}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
