import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

/**
 * Expo push notification setup.
 *
 * Flow:
 *   1. Request permission (iOS/Android 13+).
 *   2. Get the Expo push token (requires `extra.eas.projectId`).
 *   3. Register on the backend so order updates can find this device.
 *
 * Tokens are bound to a logged-in user — register only after we have a JWT.
 * On logout, call `unregisterPushToken()` to clear server-side.
 */

// Foreground behavior: show banner + play sound. Mobile UX expects this for
// transactional notifications (slip verified, shipping update).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type NotificationData = {
  kind?: "order.paid" | "order.shipping" | "order.delivered" | "chat.new";
  orderToken?: string;
  trackingNumber?: string;
};

/**
 * Request permission + fetch token + register with backend.
 * Returns the token on success, null otherwise.
 *
 * Idempotent — safe to call on every app launch.
 */
export async function registerPushToken(): Promise<string | null> {
  // Only register if we're authenticated.
  const auth = await getAuthToken();
  if (!auth) return null;

  if (!Device.isDevice) {
    // Simulators can't receive push. Silently no-op so dev doesn't see errors.
    return null;
  }

  // Android 8+ requires a notification channel before scheduling.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#e11d48",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) return null;

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
      ?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    // EAS projectId is required for production tokens; in dev it falls back
    // but we should warn so the user knows pushes won't reach prod devices.
    console.warn("[push] EAS projectId not set — token may not work in production");
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenResult.data;

  try {
    await api.me.registerPushToken(token);
  } catch (err) {
    console.warn("[push] register backend failed:", err);
  }
  return token;
}

export async function unregisterPushToken(): Promise<void> {
  try {
    await api.me.unregisterPushToken();
  } catch {
    // ignore — we're logging out anyway
  }
}

/**
 * Map a notification's `data` into a deep link inside the app.
 * Used by the root layout's `addNotificationResponseReceivedListener`.
 */
export function deepLinkFromNotification(data: NotificationData | null | undefined): string | null {
  if (!data) return null;
  switch (data.kind) {
    case "order.paid":
    case "order.shipping":
    case "order.delivered":
      return data.orderToken ? `/o/${data.orderToken}` : null;
    case "chat.new":
      // V1+ when in-app chat lands
      return null;
    default:
      return null;
  }
}
