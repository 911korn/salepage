import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Auth token storage — JWT issued by `/api/v1/auth/{line-mobile,
 * google-mobile,email-otp/verify,mobile-bridge/*}`.
 *
 * Primary store is SecureStore (iOS Keychain / Android KeyStore). If
 * that fails (911korn 2026-05-26 hit "Sign-in failed to persist" on iOS
 * — SecureStore.setItemAsync silently rejected the write), we fall back
 * to AsyncStorage so the user can still sign in. AsyncStorage isn't
 * encrypted at rest but a transient JWT is acceptable risk versus
 * blocking sign-in entirely.
 *
 * Reads check SecureStore first, then AsyncStorage. Writes attempt
 * SecureStore and fall back. Logout clears both.
 */

const KEY = "salepage:auth-token";

async function trySecureSet(token: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(KEY, token);
    return true;
  } catch (err) {
    console.warn("[auth] SecureStore.setItemAsync failed:", err);
    return false;
  }
}

async function trySecureGet(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch (err) {
    console.warn("[auth] SecureStore.getItemAsync failed:", err);
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  const ok = await trySecureSet(token);
  if (!ok) {
    // SecureStore rejected — fall back so sign-in still completes.
    await AsyncStorage.setItem(KEY, token);
    return;
  }
  // Belt-and-braces: also mirror into AsyncStorage so a cold-start
  // Keychain hiccup doesn't lock the user out.
  try {
    await AsyncStorage.setItem(KEY, token);
  } catch {
    // ignore — SecureStore copy is the source of truth.
  }
}

export async function getAuthToken(): Promise<string | null> {
  const fromSecure = await trySecureGet();
  if (fromSecure) return fromSecure;
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function clearAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
