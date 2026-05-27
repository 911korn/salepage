import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthToken, setAuthToken } from "@/lib/auth";
import { registerPushToken } from "@/lib/push";
import { getEnv } from "@/lib/env";

/**
 * Deep-link receiver for the Google bridge auto-return.
 *
 * Two paths to "signed in":
 *  1. Token already in keychain (signin screen's poll beat us here).
 *  2. Bridge recovery — if iOS suspended the signin JS thread while
 *     the user was on accounts.google.com, the token sits in the
 *     bridge unread. We re-fetch it here using the bridgeId persisted
 *     in AsyncStorage at flow start (911korn 2026-05-27 23:10 video,
 *     same root cause as LINE).
 *
 * Polls every 300ms with a 12s deadline before falling back to /signin.
 */
const BRIDGE_KEY = "salepage:google-bridge-id";

export default function AuthGoogleReturn() {
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
        const recovered = await recoverFromBridge();
        if (recovered) {
          router.replace("/me");
          return;
        }
      } catch {
        // transient — retry
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
    <View
      style={{
        flex: 1,
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: "#10b981",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#ffffff", fontSize: 32, fontWeight: "900" }}>
          ✓
        </Text>
      </View>
      <Text style={{ fontSize: 18, fontWeight: "700", color: "#0a0a0a", marginBottom: 8 }}>
        {stillWaiting ? "Finishing sign-in…" : "Returning to sign-in…"}
      </Text>
      <ActivityIndicator color="#737373" style={{ marginTop: 8 }} />
    </View>
  );
}
