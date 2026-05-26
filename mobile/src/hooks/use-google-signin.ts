import { useState } from "react";
import { router } from "expo-router";
import { Alert } from "react-native";
import { loginWithGoogle, GoogleLoginCancelledError } from "@/lib/google-login";
import { api, ApiClientError } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";
import { registerPushToken } from "@/lib/push";

/**
 * Hook that orchestrates the full Google → SalePage JWT flow:
 *   1. PKCE auth with Google
 *   2. Exchange id_token at /api/v1/auth/google-mobile
 *   3. Persist JWT in SecureStore
 *   4. Register push token
 *   5. Navigate home (or `redirectAfter`)
 *
 * Returns { signIn, loading, error } so the UI can render a loading button.
 *
 * The signed-in user is identical to the user that would arrive via
 * Auth.js's Google provider on the web — both find/create the User by
 * lower-cased email.
 */
export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(opts: { redirectAfter?: string } = {}) {
    setError(null);
    setLoading(true);
    try {
      const { idToken } = await loginWithGoogle();
      const session = await api.auth.googleMobile(idToken);
      await setAuthToken(session.token);
      void registerPushToken().catch(() => undefined);
      router.replace((opts.redirectAfter ?? "/") as never);
    } catch (err) {
      if (err instanceof GoogleLoginCancelledError) return;
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Sign-in failed";
      setError(msg);
      Alert.alert("Sign-in failed", msg);
    } finally {
      setLoading(false);
    }
  }

  return { signIn, loading, error };
}
