import { View, Text, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { useLineSignIn } from "@/hooks/use-line-signin";

/**
 * Sign-in screen.
 *
 * Tap "Continue with LINE" → expo-auth-session opens the in-app browser →
 * LINE PKCE flow → we exchange id_token at /api/v1/auth/line-mobile and store
 * the SalePage JWT in SecureStore. See `useLineSignIn` for orchestration.
 */
export default function SignIn() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { signIn, loading } = useLineSignIn();

  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-[28px] font-bold text-fg">เข้าสู่ระบบ</Text>
        <Text className="mt-2 text-center text-[14px] text-muted">
          เข้าสู่ระบบด้วย LINE เพื่อบันทึกที่อยู่ + ดู order ทุกร้าน
        </Text>

        <View className="mt-8 w-full gap-2">
          <Button
            loading={loading}
            onPress={() => signIn({ redirectAfter: redirect })}
          >
            ดำเนินการต่อด้วย LINE
          </Button>
          <Button
            variant="outline"
            disabled={loading}
            onPress={() => {
              // Email magic-link still goes through web — same Resend flow as
              // the existing /signin web page. After clicking the email link
              // the user lands on a web tab; not yet bridged into native.
              Linking.openURL("https://salepage.in.th/signin?via=email");
            }}
          >
            ใช้อีเมล (magic link)
          </Button>
        </View>

        <Text className="mt-6 text-center text-[11px] text-muted">
          เข้าสู่ระบบแล้วถือว่ายอมรับ{" "}
          <Text
            className="text-brand-700 underline"
            onPress={() => Linking.openURL("https://salepage.in.th/terms")}
          >
            เงื่อนไขการใช้งาน
          </Text>{" "}
          และ{" "}
          <Text
            className="text-brand-700 underline"
            onPress={() => Linking.openURL("https://salepage.in.th/privacy")}
          >
            นโยบายความเป็นส่วนตัว
          </Text>
        </Text>
      </View>
    </Screen>
  );
}
