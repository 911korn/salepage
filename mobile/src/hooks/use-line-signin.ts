import { useState } from "react";
import { router } from "expo-router";
import { Alert } from "react-native";
import { loginWithLine, LineLoginCancelledError } from "@/lib/line-login";
import { api, ApiClientError } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";
import { registerPushToken } from "@/lib/push";

/**
 * Hook that orchestrates the full LINE → SalePage JWT flow:
 *   1. PKCE auth with LINE
 *   2. Exchange id_token at /api/v1/auth/line-mobile
 *   3. Persist JWT in SecureStore
 *   4. Register push token
 *   5. Navigate home
 *
 * Returns { signIn, loading, error } so the UI can render a loading button.
 */
export function useLineSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(opts: { redirectAfter?: string } = {}) {
    setError(null);
    setLoading(true);
    try {
      const { idToken } = await loginWithLine();
      const session = await api.auth.lineMobile(idToken);
      await setAuthToken(session.token);
      // Best-effort push registration — not critical to login flow.
      void registerPushToken().catch(() => undefined);
      router.replace(opts.redirectAfter ?? "/");
    } catch (err) {
      if (err instanceof LineLoginCancelledError) return;
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "เข้าสู่ระบบไม่สำเร็จ";
      setError(msg);
      Alert.alert("เข้าสู่ระบบไม่สำเร็จ", msg);
    } finally {
      setLoading(false);
    }
  }

  return { signIn, loading, error };
}
