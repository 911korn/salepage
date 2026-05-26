import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";

/**
 * Deep-link receiver for the Google bridge auto-return.
 *
 * Same shape as /auth/line — exists primarily to absorb any
 * `salepage://auth/google?ok=1` redirect that the success page might
 * fire. The mobile poll has already done the token persistence; we
 * just dismiss any open signin modal and bounce to /me.
 */
export default function AuthGoogleReturn() {
  useEffect(() => {
    try {
      router.dismissAll();
    } catch {
      // No modals to dismiss — fine.
    }
    router.replace("/me");
  }, []);

  return <View />;
}
