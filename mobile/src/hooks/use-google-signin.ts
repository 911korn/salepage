import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Alert } from "react-native";
import { loginWithGoogle, GoogleLoginCancelledError } from "@/lib/google-login";
import { setAuthToken, getAuthToken } from "@/lib/auth";
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
 * Diagnostic logging — 911korn 2026-05-26 reported Google login looping
 * back to the signin screen without an error. Each step now console.logs
 * its stage; on cancellation we Alert with the cancellation reason so the
 * silent-return path can be debugged.
 */
export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track whether the host component is still mounted. If the user
  // closes the signin sheet mid-flow, we want async errors to fall
  // silently instead of popping an Alert over whatever screen they
  // navigated to (911korn 2026-05-27 "ระหว่างกำลังเลื่อนดูหน้า Shops
  // มันขึ้น Google login timed out").
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function safeAlert(title: string, body?: string) {
    if (mountedRef.current) safeAlert(title, body);
  }

  async function signIn(opts: { redirectAfter?: string } = {}) {
    setError(null);
    setLoading(true);
    console.log("[google] signIn start");
    try {
      const result = await loginWithGoogle();
      console.log("[google] login result", {
        hasToken: Boolean(result?.token),
        tokenLen: result?.token?.length,
        userId: result?.user?.id,
      });
      if (!result?.token) {
        safeAlert(
          "Sign-in incomplete",
          "Server returned no token. Please try again.",
        );
        return;
      }
      await setAuthToken(result.token);
      // Verify the keychain actually persisted — iOS occasionally fails
      // silently if the device just came off the lock screen.
      const stored = await getAuthToken();
      console.log("[google] token persisted", {
        ok: stored === result.token,
        storedLen: stored?.length ?? 0,
      });
      if (stored !== result.token) {
        safeAlert(
          "Sign-in failed to persist",
          "iOS keychain didn't save the token. Please retry.",
        );
        return;
      }
      void registerPushToken().catch(() => undefined);
      const dest = opts.redirectAfter ?? "/me";
      console.log("[google] navigating to", dest);
      // Signin is a modal — `router.replace` inside it just swaps the
      // modal's content, leaving the parent screen with stale auth.
      // Dismiss the modal first, then navigate the parent stack.
      // `canDismiss()` guards against the POP_TO_TOP dev warning.
      try {
        if (router.canDismiss()) router.dismissAll();
      } catch {
        // Older expo-router versions — fine.
      }
      router.replace(dest as never);
    } catch (err) {
      if (err instanceof GoogleLoginCancelledError) {
        // 911korn 2026-05-26: the silent-cancellation return was masking
        // real failures. Surface it so we know when it fires.
        safeAlert(
          "Sign-in cancelled",
          "Google sign-in was cancelled or timed out. Please try again.",
        );
        return;
      }
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
      safeAlert("Sign-in failed", msg);
    } finally {
      setLoading(false);
    }
  }

  return { signIn, loading, error };
}
