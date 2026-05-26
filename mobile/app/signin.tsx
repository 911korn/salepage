import { View, Text, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { useLineSignIn } from "@/hooks/use-line-signin";
import { useGoogleSignIn } from "@/hooks/use-google-signin";

/**
 * Sign-in screen.
 *
 * Two primary providers:
 *   - LINE (green button, brand color #06C755) — preferred for Thai buyers
 *   - Google (white button with G mark) — for buyers without LINE accounts
 *
 * Both flows use OAuth 2.0 PKCE via expo-auth-session and converge on the
 * same SalePage `User` row keyed by lower-cased email. That means a buyer
 * who first signed in on the web via Auth.js's Google provider lands on
 * the SAME account when they tap "Continue with Google" in the app.
 */
export default function SignIn() {
  const { t } = useTranslation("nav");
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const lineSignIn = useLineSignIn();
  const googleSignIn = useGoogleSignIn();
  const anyLoading = lineSignIn.loading || googleSignIn.loading;

  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-[28px] font-bold text-fg">
          {t("signin.title")}
        </Text>
        <Text className="mt-2 text-center text-[14px] text-muted">
          {t("signin.subtitle")}
        </Text>

        <View className="mt-8 w-full gap-2.5">
          <Button
            variant="line"
            loading={lineSignIn.loading}
            disabled={anyLoading}
            onPress={() => lineSignIn.signIn({ redirectAfter: redirect })}
          >
            💬 {t("signin.lineBtn")}
          </Button>

          <Button
            variant="google"
            loading={googleSignIn.loading}
            disabled={anyLoading}
            onPress={() => googleSignIn.signIn({ redirectAfter: redirect })}
          >
            🟦 {t("signin.googleBtn")}
          </Button>

          {/* Divider */}
          <View className="my-2 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-border" />
            <Text className="text-[11px] uppercase text-muted">
              {t("signin.or")}
            </Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          <Button
            variant="outline"
            disabled={anyLoading}
            onPress={() => {
              // Email magic-link still goes through web — same Resend flow as
              // the existing /signin web page. After clicking the email link
              // the user lands on a web tab; not yet bridged into native.
              Linking.openURL("https://salepage.in.th/signin?via=email");
            }}
          >
            ✉️ {t("signin.emailBtn")}
          </Button>
        </View>

        <Text className="mt-6 text-center text-[11px] text-muted">
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
      </View>
    </Screen>
  );
}
