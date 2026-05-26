import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { getAuthToken } from "@/lib/auth";

/**
 * Deep-link receiver for the Google bridge auto-return.
 *
 * Same shape as /auth/line — polls getAuthToken until the JWT lands in
 * the keychain (race: deep link fires ~300ms after server JWT write,
 * but the mobile poll iteration may not run for another ~1.5s), then
 * routes to /me.
 *
 * No dismissAll: the deep link arrives on the root stack so there's
 * nothing to pop, and unconditional dismissAll on an empty stack
 * triggers POP_TO_TOP in dev.
 */
export default function AuthGoogleReturn() {
  const [stillWaiting, setStillWaiting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 12_000;
    const check = async () => {
      if (cancelled) return;
      try {
        const token = await getAuthToken();
        if (token) {
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
