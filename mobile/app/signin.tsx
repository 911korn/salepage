import { useEffect, useState } from "react";
import { View, Text, Linking, ScrollView, Pressable, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as AppleAuthentication from "expo-apple-authentication";
import { ChevronLeft } from "lucide-react-native";
import { safeBack } from "@/lib/safe-back";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/brand/app-logo";
import { GoogleGMark } from "@/components/brand/google-g";
import { LineMark } from "@/components/brand/line-mark";
import { useLineSignIn } from "@/hooks/use-line-signin";
import { useGoogleSignIn } from "@/hooks/use-google-signin";
import { useAppleSignIn } from "@/hooks/use-apple-signin";

/**
 * Sign-in screen.
 *
 * Layout intent (911korn 2026-05-26: "ทำดีๆ บอกแล้วอย่าชุ่ย"):
 *   - Brand-tinted gradient bleeds under the status bar so the back pill +
 *     status text float on a warm pink, not on a flat white strip with a
 *     hard edge into the pink below.
 *   - Content is pushed below the floating back button by exactly enough
 *     to clear it (status bar inset + ~64px), so the AppLogo never
 *     overlaps the chrome.
 *   - Hero section sits inside the gradient region; OAuth card lifts above
 *     it on a white tile with soft shadow.
 *
 * Both OAuth providers converge on the same SalePage User row keyed by
 * lower-cased email — buyers who signed in on web via Google land here
 * on the SAME account.
 */
export default function SignIn() {
  const { t } = useTranslation("nav");
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const insets = useSafeAreaInsets();
  const lineSignIn = useLineSignIn();
  const googleSignIn = useGoogleSignIn();
  const appleSignIn = useAppleSignIn();
  const anyLoading = lineSignIn.loading || googleSignIn.loading || appleSignIn.loading;

  // Runtime detection of the expo-apple-authentication native module —
  // an older binary (OTA'd to a newer JS bundle) will lack the native
  // module and the button renders as <UnimplementedView> + a red error.
  // We treat "did the call throw" as the module-presence signal — the
  // boolean it returns just reflects whether iCloud is signed in, which
  // we don't want to gate on (Apple's sheet will prompt them to sign in
  // if needed). 911korn 2026-05-27 "Login With apple ยังไม่ขึ้นหน้าแอพ"
  // turned out to be the iCloud-not-detected case on Build 10.
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let cancelled = false;
    (async () => {
      try {
        await AppleAuthentication.isAvailableAsync();
        if (!cancelled) setAppleAvailable(true);
      } catch {
        if (!cancelled) setAppleAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Header chrome = status bar + 40px back button + 12px breathing
  const topGap = insets.top + 52;
  const gradientHeight = insets.top + 360;

  return (
    // Wrapper bg matches the gradient start color so the area under
    // the iOS status bar (and any rendering gap above the LinearGradient)
    // is still warm-pink, not jarring white (911korn 2026-05-27 "Patch
    // กราฟฟิกตรงนี้ให้มันเต็มๆ ที").
    <View className="flex-1" style={{ backgroundColor: "#ffe4e6" }}>
      {/* Full-bleed gradient. Now that the native header is hidden the
          gradient really does start at top 0 of the screen container,
          covering all the way up to where iOS draws the status bar. */}
      <LinearGradient
        pointerEvents="none"
        colors={["#fecdd3", "#ffe4e6", "#fff1f2", "#ffffff"]}
        locations={[0, 0.25, 0.65, 1]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: gradientHeight + insets.top,
        }}
      />

      {/* Manual back button — replaces the Stack header we just turned
          off. Floats top-left on the gradient. */}
      <Pressable
        onPress={() => safeBack()}
        hitSlop={8}
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "#ffffff",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 3,
        }}
      >
        <ChevronLeft size={22} color="#e11d48" strokeWidth={2.5} />
      </Pressable>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: topGap,
          paddingHorizontal: 24,
          paddingBottom: 40,
          minHeight: "100%",
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View className="items-center mt-2">
          <AppLogo size={42} hero />
          <Text className="mt-7 text-[26px] font-extrabold text-fg text-center leading-tight">
            {t("signin.title")}
          </Text>
          <Text className="mt-3 text-[14px] text-muted text-center leading-relaxed max-w-[280px]">
            {t("signin.subtitle")}
          </Text>
        </View>

        {/* OAuth card */}
        <View
          className="mt-10 rounded-3xl bg-white p-5 border border-border"
          style={{
            shadowColor: "#0a0a0a",
            shadowOpacity: 0.06,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 2,
          }}
        >
          {/* Apple Sign In — iOS only (mandatory per App Store Review
              Guideline 4.8 when any other 3rd-party login is present).
              Uses the OS-native sheet with biometric auth — no password
              typing. Rendered FIRST on iOS so Apple is happy.
              Gated on `appleAvailable` so older binaries that received
              this JS via OTA don't blow up on the missing native module. */}
          {Platform.OS === "ios" && appleAvailable ? (
            <>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={16}
                style={{ width: "100%", height: 52 }}
                onPress={() => appleSignIn.signIn({ redirectAfter: redirect })}
              />
              <View className="h-3" />
            </>
          ) : null}

          <Button
            variant="line"
            size="lg"
            loading={lineSignIn.loading}
            disabled={anyLoading}
            leftIcon={<LineMark size={20} />}
            onPress={() => lineSignIn.signIn({ redirectAfter: redirect })}
          >
            {t("signin.lineBtn")}
          </Button>

          <View className="h-3" />

          <Button
            variant="google"
            size="lg"
            loading={googleSignIn.loading}
            disabled={anyLoading}
            leftIcon={<GoogleGMark size={20} />}
            onPress={() => googleSignIn.signIn({ redirectAfter: redirect })}
          >
            {t("signin.googleBtn")}
          </Button>

          {/* Divider */}
          <View className="my-5 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-border" />
            <Text className="text-[11px] uppercase tracking-wider text-muted">
              {t("signin.or")}
            </Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          <Pressable
            disabled={anyLoading}
            onPress={() => {
              const dest = redirect
                ? `/signin/email?redirect=${encodeURIComponent(redirect)}`
                : "/signin/email";
              router.push(dest as never);
            }}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-soft px-5 py-4 active:bg-border/40"
          >
            <Text className="text-[15px] font-semibold text-fg">
              {t("signin.emailBtn")}
            </Text>
          </Pressable>
        </View>

        {/* Value props row — quick reasons to sign in */}
        <View className="mt-7 flex-row justify-around px-2">
          <ValueProp label={t("signin.valueOrders")} />
          <ValueProp label={t("signin.valueAddresses")} />
          <ValueProp label={t("signin.valueLoyalty")} />
        </View>

        {/* Terms footer */}
        <Text className="mt-10 text-center text-[11px] leading-relaxed text-muted px-4">
          {t("signin.termsAccept")}{" "}
          <Text
            className="text-brand-700 underline"
            onPress={() => Linking.openURL("https://salepage.in.th/terms")}
          >
            {t("signin.terms")}
          </Text>{" "}
          {t("signin.and")}{" "}
          <Text
            className="text-brand-700 underline"
            onPress={() => Linking.openURL("https://salepage.in.th/privacy")}
          >
            {t("signin.privacy")}
          </Text>
        </Text>
      </ScrollView>
    </View>
  );
}

function ValueProp({ label }: { label: string }) {
  return (
    <View className="items-center gap-1 max-w-[100px]">
      <View className="h-1.5 w-1.5 rounded-full bg-brand-500" />
      <Text className="text-[11px] text-muted text-center leading-tight">{label}</Text>
    </View>
  );
}
