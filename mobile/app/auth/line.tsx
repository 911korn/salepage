import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthToken, setAuthToken } from "@/lib/auth";
import { registerPushToken } from "@/lib/push";
import { getEnv } from "@/lib/env";

/**
 * Deep-link receiver for the LIFF auto-return.
 *
 * The LIFF success page navigates here via `salepage://auth/line?ok=1`.
 * Two paths to "signed in":
 *
 *  1. **Token already in keychain** — the signin screen's polling loop
 *     beat us here and `setAuthToken` already wrote. Just route to /me.
 *
 *  2. **Recovery path** (911korn 2026-05-27 23:10: video at 11:10pm
 *     showed user stranded on /me with "not signed in" despite
 *     successful LINE LIFF auth server-side). iOS may have suspended
 *     the signin screen's JS thread while the user was in the LINE
 *     app. When they come back, the polling loop is gone — but the
 *     server-side bridge still has the token. We read the bridgeId
 *     from AsyncStorage (persisted at flow start), fetch the bridge
 *     once ourselves, and adopt the token.
 *
 * Polls every 300ms with a 12s deadline before falling back to /signin.
 */
const BRIDGE_KEY = "salepage:line-bridge-id";

export default function AuthLineReturn() {
  const [stillWaiting, setStillWaiting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 12_000;
    const env = getEnv();
    const apiBase = env.apiBaseUrl.replace(/\/+$/, "");

    async function recoverFromBridge(): Promise<boolean> {
      try {
        const bridgeId = await AsyncStorage.getItem(BRIDGE_KEY);
        if (!bridgeId) return false;
        const res = await fetch(
          `${apiBase}/api/v1/auth/mobile-bridge/poll?bridge=${encodeURIComponent(bridgeId)}`,
        );
        const json = (await res.json()) as {
          ok: boolean;
          data?: { pending: boolean; token?: string };
        };
        if (!json.ok || !json.data || json.data.pending) return false;
        const token = json.data.token;
        if (!token) return false;
        await setAuthToken(token);
        // Clear the stored bridge id so a stale value can't leak into a
        // future signin attempt.
        try {
          await AsyncStorage.removeItem(BRIDGE_KEY);
        } catch {
          /* ignore */
        }
        void registerPushToken().catch(() => undefined);
        return true;
      } catch {
        return false;
      }
    }

    const check = async () => {
      if (cancelled) return;
      try {
        const token = await getAuthToken();
        if (token) {
          router.replace("/me");
          return;
        }
        // Fast-path failed — try recovering from the bridge directly.
        const recovered = await recoverFromBridge();
        if (recovered) {
          router.replace("/me");
          return;
        }
      } catch {
        // Keychain transient failure — try again on next tick.
      }
      if (Date.now() > deadline) {
        setStillWaiting(false);
        router.replace("/signin");
        return;
      }
      setTimeout(check, 300);
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#06C755" }}>
      <LinearGradient
        pointerEvents="none"
        colors={["#06C755", "#05a946"]}
        style={{ position: "absolute", inset: 0 }}
      />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: "900",
            color: "#ffffff",
            letterSpacing: 0.6,
            marginBottom: 18,
          }}
        >
          LINE
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.95)",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          {stillWaiting ? "Finishing sign-in…" : "Returning to sign-in…"}
        </Text>
        <ActivityIndicator color="#ffffff" />
      </View>
    </View>
  );
}
