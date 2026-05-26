import * as SecureStore from "expo-secure-store";

/**
 * Auth token storage — JWT issued by `/api/v1/auth/line-mobile`.
 *
 * iOS uses Keychain; Android uses AndroidKeyStore-backed encrypted prefs.
 * Falls back gracefully if SecureStore is unavailable (e.g. web).
 */

const KEY = "salepage:auth-token";

export async function setAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, token, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } catch {
    // SecureStore not available (e.g. web during dev); silently no-op.
    // Calling code should rely on stale in-memory token until next launch.
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function clearAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore — best-effort
  }
}
