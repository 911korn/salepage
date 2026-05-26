import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";

/**
 * Deep-link receiver for the LIFF auto-return.
 *
 * The LIFF page navigates here via `Linking.createURL("/auth/line?ok=1")`
 * (Expo Go: `exp://192.168.x.x:8081/--/auth/line?ok=1`, EAS:
 * `salepage://auth/line?ok=1`) after LINE auth completes. The mobile
 * poll loop has already persisted the JWT by this point; we just need
 * to dismiss any open signin modal so the underlying tabs re-mount with
 * the new auth state.
 *
 * The screen renders nothing visible — it pops itself off the stack as
 * soon as the dismiss + replace complete.
 */
export default function AuthLineReturn() {
  useEffect(() => {
    try {
      router.dismissAll();
    } catch {
      // No modals to dismiss — fine.
    }
    // Navigate to the /me tab where the user can see their logged-in state.
    router.replace("/me");
  }, []);

  return <View />;
}
