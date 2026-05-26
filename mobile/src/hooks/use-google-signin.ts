import { useState } from "react";
import { router } from "expo-router";
import { Alert } from "react-native";
import { loginWithGoogle, GoogleLoginCancelledError } from "@/lib/google-login";
import { setAuthToken } from "@/lib/auth";
import { registerPushToken } from "@/lib/push";

/**
 * Hook that orchestrates the full Google → SalePage JWT flow via the
 * server-side bridge:
 *   1. POST /mobile-bridge/start
 *   2. Open browser to bridge URL, poll until JWT comes back
 *   3. Persist JWT in SecureStore
 *   4. Register push token
 *   5. Navigate home (or `redirectAfter`)
 *
 * The signed-in user is identical to the user that would arrive via
 * Auth.js's Google provider on the web — same OAuth client, same Auth.js
 * adapter, same User row keyed by lower-cased email.
 */
export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(opts: { redirectAfter?: string } = {}) {
    setError(null);
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      await setAuthToken(result.token);
      void registerPushToken().catch(() => undefined);
      router.replace((opts.redirectAfter ?? "/") as never);
    } catch (err) {
      if (err instanceof GoogleLoginCancelledError) return;
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
      Alert.alert("Sign-in failed", msg);
    } finally {
      setLoading(false);
    }
  }

  return { signIn, loading, error };
}
