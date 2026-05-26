import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/ui/screen";
import { TabBar } from "@/components/ui/tab-bar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getAuthToken, clearAuthToken } from "@/lib/auth";
import { unregisterPushToken } from "@/lib/push";
import { useSellerMode } from "@/store/seller-mode";
import { setAppLang, type AppLang, SUPPORTED_LANGS } from "@/lib/i18n";

export default function MeScreen() {
  const { t, i18n } = useTranslation(["common", "me"]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const queryClient = useQueryClient();
  const setMode = useSellerMode((s) => s.setMode);

  useEffect(() => {
    void getAuthToken().then((tok) => setAuthed(Boolean(tok)));
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
    Alert.alert(t("auth.signOut"), t("auth.signOut") + "?", [
      { text: t("actions.cancel"), style: "cancel" },
      {
        text: t("auth.signOut"),
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

  const currentLang = (i18n.language as AppLang) || "th";

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-10 pb-4">
          <Text className="text-[24px] font-bold text-fg">{t("me:title")}</Text>
        </View>

        {!authed ? (
          <View className="mx-5 rounded-3xl border border-border bg-white p-6">
            <Text className="text-[15px] font-semibold text-fg">
              {t("me:guestHeadline")}
            </Text>
            <Text className="mt-1 text-[12px] text-muted">
              {t("me:guestSubtitle")}
            </Text>
            <Button
              className="mt-4"
              onPress={() => router.push("/signin?redirect=/me")}
            >
              {t("auth.signIn")}
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
                <Text
                  className="text-[16px] font-semibold text-fg"
                  numberOfLines={1}
                >
                  {profileQuery.data.name ?? t("appName")}
                </Text>
                <Text className="text-[12px] text-muted" numberOfLines={1}>
                  {profileQuery.data.email}
                </Text>
              </View>
            </View>

            {/* Stats */}
            <View className="mx-5 mt-3 flex-row gap-2">
              <Stat
                label={t("tabs.orders")}
                value={profileQuery.data.orderCount}
              />
              <Stat
                label={t("me:menu.following")}
                value={profileQuery.data.followingCount}
              />
              <Stat
                label={t("me:menu.favorites")}
                value={profileQuery.data.favoriteCount}
              />
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
                    {t("me:menu.sellerMode")}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-amber-700">
                    {ownedShopsQuery.data!.shops.length} shop(s)
                  </Text>
                </View>
                <Text className="text-[18px] text-amber-700">›</Text>
              </Pressable>
            ) : null}

            <View className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white">
              <MenuItem
                label={t("me:menu.orders")}
                onPress={() => router.push("/orders")}
              />
              <MenuItem
                label={t("me:menu.wallet")}
                onPress={() => router.push("/me/wallet")}
              />
              <MenuItem
                label={t("me:menu.earnings")}
                onPress={() => router.push("/me/earnings")}
              />
              <MenuItem
                label={t("me:menu.addresses")}
                onPress={() => router.push("/me/addresses")}
              />
              <MenuItem
                label={t("me:menu.notifications")}
                onPress={() => router.push("/me/notifications")}
              />
              <MenuItem
                label={t("me:menu.kyc")}
                onPress={() => router.push("/me/kyc")}
              />
            </View>
          </>
        ) : null}

        {/* Language switcher — visible to everyone, signed in or not. */}
        <View className="mx-5 mt-4 rounded-3xl border border-border bg-white p-4">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t("language.label")}
          </Text>
          <View className="mt-3 flex-row gap-2">
            {(SUPPORTED_LANGS as readonly AppLang[]).map((lng) => {
              const active = lng === currentLang;
              return (
                <Pressable
                  key={lng}
                  onPress={() => {
                    void setAppLang(lng);
                  }}
                  className={`flex-1 items-center rounded-2xl border px-3 py-2.5 ${
                    active
                      ? "border-brand-500 bg-brand-50"
                      : "border-border bg-white"
                  }`}
                >
                  <Text
                    className={`text-[13px] font-semibold ${
                      active ? "text-brand-700" : "text-fg"
                    }`}
                  >
                    {lng === "th" ? "🇹🇭 " : "🇬🇧 "}
                    {t(lng === "th" ? "language.thai" : "language.english")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white">
          <MenuItem
            label="Terms"
            onPress={() => Linking.openURL("https://salepage.in.th/terms")}
          />
          <MenuItem
            label="Privacy"
            onPress={() => Linking.openURL("https://salepage.in.th/privacy")}
          />
          <MenuItem
            label="Contact"
            onPress={() => Linking.openURL("https://salepage.in.th/contact")}
          />
        </View>

        {authed ? (
          <View className="mx-5 mt-4">
            <Button variant="outline" onPress={handleLogout}>
              {t("me:menu.signOut")}
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
      <Text className="text-[11px] uppercase tracking-wider text-muted">
        {label}
      </Text>
      <Text className="mt-1 text-[20px] font-bold text-fg">{value}</Text>
    </View>
  );
}

function MenuItem({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
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
