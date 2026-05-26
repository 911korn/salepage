import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { api, ApiClientError } from "@/lib/api";
import { useSellerMode } from "@/store/seller-mode";

/**
 * /seller/chat/[id] — single conversation thread.
 *
 * Polls every 5s for new inbound messages. We optimistically prepend the
 * outbound reply on send so the input feels instant; the server response
 * (with the real `id` + `createdAt`) replaces it on the next refetch.
 */
export default function ChatThreadScreen() {
  const slug = useSellerMode((s) => s.activeShopSlug);
  const { id } = useLocalSearchParams<{ id: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const qc = useQueryClient();

  const convQuery = useQuery({
    queryKey: ["seller", "conversation", slug, id],
    queryFn: () => api.shops.conversation(slug!, id!),
    enabled: Boolean(slug && id),
    refetchInterval: 5_000,
  });

  const [draft, setDraft] = useState("");

  const sendMutation = useMutation({
    mutationFn: (text: string) => api.shops.sendMessage(slug!, id!, text),
    onSuccess: () => {
      setDraft("");
      void convQuery.refetch();
      // Also refresh the list so unreadCount/lastMessage stay in sync.
      void qc.invalidateQueries({
        queryKey: ["seller", "conversations", slug],
      });
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "ส่งข้อความไม่สำเร็จ";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  // Auto-scroll to the bottom whenever new messages arrive.
  useEffect(() => {
    if (convQuery.data?.conversation.messages.length) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [convQuery.data?.conversation.messages.length]);

  if (!slug || !id) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-fg">เกิดข้อผิดพลาด</Text>
          <Pressable onPress={() => router.back()} className="mt-4">
            <Text className="text-brand-700">กลับ</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const conv = convQuery.data?.conversation;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        {conv ? (
          <View className="flex-row items-center gap-3 border-b border-border bg-white px-5 py-3">
            <View className="size-10 overflow-hidden rounded-full bg-brand-100">
              {conv.customerPictureUrl ? (
                <Image
                  source={{ uri: conv.customerPictureUrl }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : (
                <View className="size-full items-center justify-center">
                  <Text className="text-[14px] font-bold text-brand-700">
                    {(conv.customerName ?? "?").slice(0, 1)}
                  </Text>
                </View>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[14px] font-semibold text-fg" numberOfLines={1}>
                {conv.customerName ?? "ลูกค้า LINE"}
              </Text>
              <Text className="text-[10px] text-muted">
                ส่งผ่าน LINE Official Account
              </Text>
            </View>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          contentContainerClassName="px-4 py-4 gap-2"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          {convQuery.isLoading ? (
            <View className="py-16">
              <ActivityIndicator color="#e11d48" />
            </View>
          ) : (
            conv?.messages.map((m) => (
              <View
                key={m.id}
                className={
                  m.direction === "OUTBOUND"
                    ? "self-end max-w-[80%]"
                    : "self-start max-w-[80%]"
                }
              >
                <View
                  className={`rounded-2xl px-3 py-2 ${
                    m.direction === "OUTBOUND"
                      ? "bg-brand-600"
                      : "bg-white border border-border"
                  }`}
                >
                  {m.text ? (
                    <Text
                      className={`text-[13px] leading-relaxed ${
                        m.direction === "OUTBOUND" ? "text-white" : "text-fg"
                      }`}
                    >
                      {m.text}
                    </Text>
                  ) : m.imageUrl ? (
                    <Image
                      source={{ uri: m.imageUrl }}
                      style={{ width: 200, height: 200, borderRadius: 12 }}
                      contentFit="cover"
                    />
                  ) : null}
                </View>
                <Text
                  className={`mt-0.5 px-1 text-[9px] text-muted ${
                    m.direction === "OUTBOUND" ? "text-right" : "text-left"
                  }`}
                >
                  {new Date(m.createdAt).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        {/* Composer */}
        <View className="flex-row items-end gap-2 border-t border-border bg-white px-3 py-3 pb-6">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="พิมพ์ตอบลูกค้า..."
            multiline
            className="flex-1 max-h-32 rounded-2xl border border-border bg-soft px-3 py-2.5 text-[14px] text-fg"
          />
          <Pressable
            disabled={!draft.trim() || sendMutation.isPending}
            onPress={() => sendMutation.mutate(draft.trim())}
            className={`size-11 items-center justify-center rounded-full ${
              draft.trim() ? "bg-brand-600" : "bg-zinc-300"
            }`}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[16px] text-white">↑</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
