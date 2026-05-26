import { useState } from "react";
import { router } from "expo-router";
import { Alert } from "react-native";
import { loginWithLine, LineLoginCancelledError } from "@/lib/line-login";
import { setAuthToken } from "@/lib/auth";
import { registerPushToken } from "@/lib/push";

/**
 * Hook that orchestrates the LINE → SalePage JWT flow via the
 * server-side bridge.
 *
 *   1. POST /api/v1/auth/mobile-bridge/start { provider: "line" }
 *   2. Open browser to /mobile-bridge/line, poll until JWT
 *   3. Persist JWT in SecureStore + register push token
 *   4. Navigate home (or `redirectAfter`)
 *
 * Works in both Expo Go and EAS builds — same User row as the email-OTP
 * + Google bridges + web Auth.js providers.
 */
export function useLineSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(opts: { redirectAfter?: string } = {}) {
    setError(null);
    setLoading(true);
    try {
      const result = await loginWithLine();
      await setAuthToken(result.token);
      void registerPushToken().catch(() => undefined);
      // Signin is a modal — `router.replace` inside the modal would just
      // swap the modal's content, leaving the parent screen with stale
      // auth state. Dismiss all modals first, then navigate the parent
      // stack so the tabs re-mount with the new token.
      try {
        router.dismissAll();
      } catch {
        // No modals open — fine.
      }
      if (opts.redirectAfter) {
        router.replace(opts.redirectAfter as never);
      } else {
        router.replace("/me");
      }
    } catch (err) {
      if (err instanceof LineLoginCancelledError) return;
      const msg = err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ";
      setError(msg);
      Alert.alert("เข้าสู่ระบบไม่สำเร็จ", msg);
    } finally {
      setLoading(false);
    }
  }

  return { signIn, loading, error };
}
