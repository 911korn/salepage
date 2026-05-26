import { View, Text, Linking, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/brand/app-logo";
import { GoogleGMark } from "@/components/brand/google-g";
import { LineMark } from "@/components/brand/line-mark";
import { useLineSignIn } from "@/hooks/use-line-signin";
import { useGoogleSignIn } from "@/hooks/use-google-signin";

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
  const anyLoading = lineSignIn.loading || googleSignIn.loading;

  // Header chrome = status bar + 40px back button + 12px breathing
  const topGap = insets.top + 52;
  const gradientHeight = insets.top + 360;

  return (
    <View className="flex-1 bg-white">
      {/* Full-bleed gradient — extends under the status bar so the back
          button (and the iOS time) sit on warm pink, not on white. */}
      <LinearGradient
        colors={["#ffe4e6", "#fff1f2", "#ffffff"]}
        locations={[0, 0.55, 1]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: gradientHeight,
        }}
      />

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
