import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import * as Updates from "expo-updates";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/brand/app-logo";
import { api } from "@/lib/api";
import { getAuthToken, clearAuthToken } from "@/lib/auth";
import { unregisterPushToken } from "@/lib/push";
import { useSellerMode } from "@/store/seller-mode";
import { useCart } from "@/store/cart";
import { setAppLang, type AppLang, SUPPORTED_LANGS } from "@/lib/i18n";

export default function MeScreen() {
  const { t, i18n } = useTranslation(["common", "me"]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const queryClient = useQueryClient();
  const setMode = useSellerMode((s) => s.setMode);

  // Re-read the auth token on every focus — not just once on mount.
  // Without this, the modal-based signin flow leaves /me with
  // `authed===null/false` after the modal dismisses, because /me never
  // unmounts and the original useEffect doesn't re-run.
  useFocusEffect(
    useCallback(() => {
      void getAuthToken().then((tok) => setAuthed(Boolean(tok)));
    }, []),
  );

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

  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  // No Alert.alert — 911korn 2026-05-27 23:35: "Logout จาก LINE แล้ว
  // ทุกอย่างค้าง" persisted through 3 OTA iterations of the Alert-
  // based flow. The native Alert dialog appears to interact badly
  // with /me's state-reset sequence on iOS (touch events stopped
  // reaching the React tree after the destructive button fired).
  // We render our own in-React confirmation banner instead, which
  // keeps the whole flow on the JS thread and inside the React
  // render cycle.
  function handleLogout() {
    setConfirmLogoutOpen(true);
  }

  async function performLogout() {
    // 911korn 2026-05-27 23:35: through 4 OTAs the UI still froze
    // after logout from LINE-signed-in state — Alert vs inline,
    // sync vs async, await vs fire-and-forget, none of it mattered.
    // The bridge / RN runtime is wedging somewhere we can't reach
    // from JS state manipulation.
    //
    // Nuclear option: hide the confirm panel, clear the keychain +
    // server push token, then reload the JS bundle. Everything
    // remounts from scratch with `authed === null` → useFocusEffect
    // reads getAuthToken() → returns null → guest view. Zero stale
    // state, zero stuck native modals, zero React Query subscribers
    // looping.
    setConfirmLogoutOpen(false);
    try {
      await clearAuthToken();
    } catch {
      /* SecureStore can fail silently */
    }
    void unregisterPushToken();
    // Reset persisted Zustand stores BEFORE reload so they don't
    // rehydrate the previous user's cart / seller-mode on relaunch.
    useCart.getState().clear();
    useSellerMode.setState({ mode: "buyer", activeShopSlug: null });
    try {
      await Updates.reloadAsync();
    } catch {
      // In Expo Go or if Updates isn't available — fall back to
      // best-effort state reset so the dev experience still works.
      queryClient.clear();
      setAuthed(false);
    }
  }

  // Apple Guideline 5.1.1(v): in-app account deletion. Same UX shape
  // as logout (inline confirm card) but with sharper warning copy +
  // a separate "confirm" state so the buyer can't accidentally tap
  // through. After server returns, we reload the bundle to land on a
  // fully fresh guest state.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function performDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.me.deleteAccount();
      // Sever local state in the same order as logout.
      await clearAuthToken().catch(() => undefined);
      void unregisterPushToken();
      useCart.getState().clear();
      useSellerMode.setState({ mode: "buyer", activeShopSlug: null });
      await Updates.reloadAsync();
    } catch (e) {
      setDeleting(false);
      Alert.alert(
        "ลบบัญชีไม่สำเร็จ",
        e instanceof Error ? e.message : "กรุณาลองใหม่อีกครั้ง",
      );
    }
  }

  if (authed === null) {
    return (
      <Screen safeTop>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" />
        </View>
      </Screen>
    );
  }

  const currentLang = (i18n.language as AppLang) || "th";

  return (
    <Screen safeTop>
      <ScrollView contentContainerClassName="pb-32">
        {/* Brand only — the tab bar already names this tab, so showing
            "Me / ฉัน" here as a heading was redundant (911korn 2026-05-26
            "เอาคำว่า me ซ้ายบนออก"). */}
        <View className="px-5 pt-2 pb-4">
          <AppLogo size={22} />
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
            {/* Profile card — tap to edit name + avatar (911korn 2026-05-27
                first TestFlight feedback: "รูปโปร์ไฟล์กับชื่อ เปลี่ยนไม่ได้"). */}
            <Pressable
              onPress={() => router.push("/me/edit")}
              className="mx-5 flex-row items-center gap-3 rounded-3xl border border-border bg-white p-5"
            >
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
              <Text className="text-[12px] text-brand-700">แก้ไข ›</Text>
            </Pressable>

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
            ) : ownedShopsQuery.data ? (
              /* "Open your shop" CTA — only when the shops query has resolved
                  and returned zero results (avoid flashing the CTA during
                  load). 911korn 2026-05-27 first TestFlight feedback "ในแอพ
                  มันไม่มีปุ่มเปิดร้าน". */
              <Pressable
                onPress={() => router.push("/seller/create-shop")}
                className="mx-5 mt-4 flex-row items-center gap-3 rounded-3xl bg-zinc-900 p-4"
              >
                <View className="size-10 items-center justify-center rounded-full bg-white">
                  <Text className="text-[18px]">🏪</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[14px] font-bold text-white">
                    เปิดร้านของคุณ
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-zinc-400">
                    สร้างร้านใน 30 วินาที · ขายฟรี ไม่หักค่าธรรมเนียม
                  </Text>
                </View>
                <Text className="text-[18px] text-white">›</Text>
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
            label={t("me:menu.terms")}
            onPress={() => Linking.openURL("https://salepage.in.th/terms")}
          />
          <MenuItem
            label={t("me:menu.privacy")}
            onPress={() => Linking.openURL("https://salepage.in.th/privacy")}
          />
          <MenuItem
            label={t("me:menu.contact")}
            onPress={() => Linking.openURL("https://salepage.in.th/contact")}
          />
        </View>

        {authed ? (
          <View className="mx-5 mt-4">
            {confirmLogoutOpen ? (
              <View className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <Text className="text-[14px] font-semibold text-rose-900">
                  {t("auth.signOut")}?
                </Text>
                <View className="mt-3 flex-row gap-2">
                  <Pressable
                    onPress={() => setConfirmLogoutOpen(false)}
                    className="flex-1 items-center justify-center rounded-xl border border-border bg-white py-3"
                  >
                    <Text className="text-[14px] font-semibold text-fg">
                      {t("actions.cancel")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void performLogout()}
                    className="flex-1 items-center justify-center rounded-xl bg-rose-600 py-3"
                  >
                    <Text className="text-[14px] font-semibold text-white">
                      {t("auth.signOut")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Button variant="outline" onPress={handleLogout}>
                {t("me:menu.signOut")}
              </Button>
            )}
          </View>
        ) : null}

        {/* Account deletion — Apple Guideline 5.1.1(v). Placed below
            sign-out, with a separate inline confirm so it can't be
            tapped through. Sharper warning than logout (this is
            destructive + irreversible). */}
        {authed ? (
          <View className="mx-5 mt-3">
            {confirmDeleteOpen ? (
              <View className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4">
                <Text className="text-[15px] font-bold text-rose-900">
                  ลบบัญชีนี้ถาวร?
                </Text>
                <Text className="mt-2 text-[12px] leading-relaxed text-rose-900">
                  • ออเดอร์เก่า + รีวิว + ที่อยู่จะถูกลบ{"\n"}
                  • ร้านค้าของคุณ (ถ้ามี) จะถูกปิดทันที{"\n"}
                  • LINE / Google / Apple ของคุณจะถูกถอด — เปิดบัญชีใหม่ได้ภายหลัง{"\n"}
                  • การลบนี้ไม่สามารถย้อนกลับได้
                </Text>
                <View className="mt-3 flex-row gap-2">
                  <Pressable
                    onPress={() => setConfirmDeleteOpen(false)}
                    disabled={deleting}
                    className="flex-1 items-center justify-center rounded-xl border border-border bg-white py-3"
                  >
                    <Text className="text-[14px] font-semibold text-fg">
                      ยกเลิก
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void performDeleteAccount()}
                    disabled={deleting}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-rose-700 py-3"
                  >
                    {deleting ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : null}
                    <Text className="text-[14px] font-semibold text-white">
                      {deleting ? "กำลังลบ..." : "ลบบัญชีถาวร"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setConfirmDeleteOpen(true)}
                className="items-center py-3"
              >
                <Text className="text-[13px] font-medium text-rose-700 underline">
                  {t("me:menu.deleteAccount")}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>
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
