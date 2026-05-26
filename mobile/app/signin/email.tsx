import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Keyboard,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/brand/app-logo";
import { api, ApiClientError } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";
import { registerPushToken } from "@/lib/push";
import { ArrowRight, Mail } from "lucide-react-native";

/**
 * Inline email OTP login — 911korn 2026-05-26 ("ทำงานจบได้ในแอพไม่ต้องเด้ง
 * ไปที่อื่น"). Two-step flow:
 *
 *   Step "email":  user types email → POST /email-otp/send → step "code"
 *   Step "code":   user types 6-digit code → POST /email-otp/verify →
 *                  setAuthToken + navigate to /me (or `redirect`)
 *
 * Same User row keyed by lower-cased email as Google + LINE bridges, so
 * a buyer with a web account lands on the SAME account when they sign in
 * via this email path.
 *
 * No web redirects — the entire flow happens in-app.
 */
export default function EmailSignIn() {
  const { t } = useTranslation("nav");
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<TextInput | null>(null);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // When we land on the code step, auto-focus the OTP field so the keyboard
  // appears immediately.
  useEffect(() => {
    if (step === "code") {
      const t = setTimeout(() => codeRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [step]);

  async function handleSend() {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert(
        t("signin.emailInvalidTitle", { defaultValue: "อีเมลไม่ถูกต้อง" }),
        t("signin.emailInvalidBody", {
          defaultValue: "ลองตรวจสอบรูปแบบอีเมลอีกครั้ง",
        }),
      );
      return;
    }
    setLoading(true);
    try {
      await api.auth.emailOtpSend(trimmed);
      setEmail(trimmed);
      setStep("code");
      setResendIn(60);
      setCode("");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "ลองใหม่อีกครั้ง";
      Alert.alert(t("signin.errorTitle"), msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      const result = await api.auth.emailOtpVerify(email, code);
      await setAuthToken(result.token);
      void registerPushToken().catch(() => undefined);
      // Signin is a modal — dismiss it before navigating so the tabs
      // underneath re-mount with the new auth state. Otherwise the
      // parent /me would still read getAuthToken()===null from its
      // initial mount.
      try {
        if (router.canDismiss()) router.dismissAll();
      } catch {
        // Older expo-router versions — fine.
      }
      router.replace((redirect ?? "/me") as never);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "ลองใหม่อีกครั้ง";
      Alert.alert(t("signin.errorTitle"), msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0) return;
    setLoading(true);
    try {
      await api.auth.emailOtpSend(email);
      setResendIn(60);
      setCode("");
      codeRef.current?.focus();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "ลองใหม่อีกครั้ง";
      Alert.alert(t("signin.errorTitle"), msg);
    } finally {
      setLoading(false);
    }
  }

  const topGap = insets.top + 52;
  const gradientHeight = insets.top + 360;

  return (
    <View className="flex-1 bg-white">
      <LinearGradient
        pointerEvents="none"
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
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mt-2">
          <AppLogo size={36} hero />
          <Text className="mt-7 text-[24px] font-extrabold text-fg text-center leading-tight">
            {step === "email"
              ? t("signin.emailStepTitle", { defaultValue: "ใส่อีเมลของคุณ" })
              : t("signin.codeStepTitle", { defaultValue: "ตรวจอีเมลของคุณ" })}
          </Text>
          <Text className="mt-3 text-[14px] text-muted text-center leading-relaxed max-w-[300px]">
            {step === "email"
              ? t("signin.emailStepBody", {
                  defaultValue: "เราจะส่งรหัส 6 หลักไปยังอีเมลของคุณ",
                })
              : t("signin.codeStepBody", {
                  defaultValue: `เราส่งรหัส 6 หลักไปที่ ${email} แล้ว`,
                  email,
                })}
          </Text>
        </View>

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
          {step === "email" ? (
            <>
              <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-soft px-4 py-3">
                <Mail size={18} color="#737373" strokeWidth={2} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("signin.emailPlaceholder", {
                    defaultValue: "you@example.com",
                  })}
                  placeholderTextColor="#a1a1aa"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  className="flex-1 text-[15px] text-fg"
                />
              </View>
              <View className="h-4" />
              <Button
                variant="primary"
                size="lg"
                loading={loading}
                disabled={loading || email.length < 3}
                onPress={handleSend}
              >
                {t("signin.sendCode", { defaultValue: "ส่งรหัสไปยังอีเมล" })}
              </Button>
            </>
          ) : (
            <>
              <TextInput
                ref={codeRef}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                placeholderTextColor="#cbd5e1"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerify}
                className="rounded-2xl border border-border bg-soft px-4 py-4 text-center text-[28px] font-bold tracking-[12px] text-fg"
                style={{ letterSpacing: 12 }}
              />
              <View className="h-4" />
              <Button
                variant="primary"
                size="lg"
                loading={loading}
                disabled={loading || code.length !== 6}
                onPress={handleVerify}
              >
                {t("signin.verifyCode", { defaultValue: "ยืนยันรหัส" })}
              </Button>

              {/* Resend + change-email row */}
              <View className="mt-4 flex-row items-center justify-between">
                <Pressable
                  onPress={() => {
                    setStep("email");
                    setCode("");
                  }}
                  hitSlop={8}
                >
                  <Text className="text-[13px] text-muted underline">
                    {t("signin.changeEmail", { defaultValue: "เปลี่ยนอีเมล" })}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleResend}
                  disabled={resendIn > 0 || loading}
                  hitSlop={8}
                >
                  <Text
                    className={`text-[13px] ${
                      resendIn > 0 ? "text-muted" : "text-brand-700 font-semibold"
                    }`}
                  >
                    {resendIn > 0
                      ? t("signin.resendIn", {
                          defaultValue: `ขอใหม่ในอีก ${resendIn} วิ`,
                          seconds: resendIn,
                        })
                      : t("signin.resendCode", { defaultValue: "ส่งรหัสใหม่" })}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <Text className="mt-8 text-center text-[11px] leading-relaxed text-muted px-4">
          {t("signin.emailFootnote", {
            defaultValue:
              "ยังไม่มีบัญชี? เราจะสร้างให้อัตโนมัติเมื่อยืนยันรหัสสำเร็จ",
          })}
        </Text>
      </ScrollView>
    </View>
  );
}

// Silence unused-import warning if ArrowRight ends up unused (it's exported
// here so we can swap the CTA icon later without re-importing).
void ArrowRight;
