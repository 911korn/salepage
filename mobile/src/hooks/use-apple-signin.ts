import { useState } from "react";
import { router } from "expo-router";
import { Alert, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { api } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";
import { registerPushToken } from "@/lib/push";
import { Sentry } from "@/lib/sentry";

/**
 * Sign in with Apple — required by App Store Review Guideline 4.8 for
 * any app that offers third-party login (SalePage offers Google + LINE,
 * so Apple is mandatory on iOS).
 *
 * Flow:
 *   1. AppleAuthentication.signInAsync() — opens the native iOS sheet
 *      with biometric auth, returns an identityToken (JWT signed by
 *      Apple) + the user's full name on FIRST sign-in only.
 *   2. POST /api/v1/auth/apple-mobile with the identityToken + name +
 *      email. Server verifies the JWT signature against Apple's JWKS,
 *      find-or-create the User row, returns a SalePage JWT.
 *   3. Persist JWT + register push token + navigate.
 */
export function useAppleSignIn() {
  const [loading, setLoading] = useState(false);

  async function signIn(opts: { redirectAfter?: string } = {}) {
    if (Platform.OS !== "ios") {
      Alert.alert("Apple Sign In", "พร้อมใช้งานเฉพาะบน iOS");
      return;
    }
    setLoading(true);
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        Alert.alert("Apple Sign In", "อุปกรณ์นี้ไม่รองรับ Apple Sign In");
        return;
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        Alert.alert("Sign in incomplete", "ไม่ได้รับ identityToken จาก Apple");
        return;
      }
      const res = await api.auth.appleMobile({
        idToken: credential.identityToken,
        fullName: credential.fullName
          ? {
              givenName: credential.fullName.givenName,
              familyName: credential.fullName.familyName,
            }
          : undefined,
        email: credential.email ?? undefined,
      });
      await setAuthToken(res.token);
      try {
        await registerPushToken();
      } catch (e) {
        // Push registration is best-effort. Don't fail sign-in if APNs
        // permission was denied / the device is in low-power mode.
        Sentry.captureException(e);
      }
      router.replace((opts.redirectAfter ?? "/me") as never);
    } catch (err) {
      // User cancelled — Apple returns error code "ERR_REQUEST_CANCELED".
      // Don't alert; just swallow it.
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }
      Sentry.captureException(err);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        err instanceof Error ? err.message : "Sign in with Apple ล้มเหลว",
      );
    } finally {
      setLoading(false);
    }
  }

  return { signIn, loading };
}
