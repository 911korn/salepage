import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getAuthToken } from "@/lib/auth";

/**
 * Deep-link receiver for the LIFF auto-return.
 *
 * The LIFF success page navigates here via `salepage://auth/line?ok=1`
 * (Expo Go: `exp://192.168.x.x:8081/--/auth/line?ok=1`). The mobile poll
 * loop is the canonical source of the JWT — it fires `setAuthToken`
 * once `/poll` returns the token. There's a race because the LIFF
 * deep-link fires ~300ms after the server writes the JWT to the bridge
 * row, but the poll iteration may not run for another ~1.5s.
 *
 * 911korn 2026-05-26 video frame 11 showed this race in action: deep
 * link arrived → router.replace("/me") fired → /me mounted with
 * getAuthToken()===null → "Not signed in" was shown. The poll then
 * arrived later but /me was already focused so useFocusEffect didn't
 * re-fire.
 *
 * Fix: wait for the token to actually be in keychain BEFORE we route
 * to /me. Polls every 300ms with a 12s deadline. Renders a brand-green
 * splash so it doesn't look like a 404.
 */
export default function AuthLineReturn() {
  const [stillWaiting, setStillWaiting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 12_000;
    const check = async () => {
      if (cancelled) return;
      try {
        const token = await getAuthToken();
        if (token) {
          // Token is persisted — route to /me. We deliberately do NOT
          // call router.dismissAll() here: the deep link arrives on the
          // root stack so there's nothing to pop, and dismissAll on an
          // empty stack throws POP_TO_TOP in dev. The signin hooks
          // handle modal dismissal independently when the poll completes
          // their side.
          router.replace("/me");
          return;
        }
      } catch {
        // Keychain transient failure — try again
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
