import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Affiliate referral tracking (V1.5).
 *
 * When a user opens the app via a `?ref=<userId>` deep link (e.g.
 * `https://salepage.in.th/s/nornnao?ref=usr_abc123`), we persist that ref
 * for 30 days. The next order placed during that window posts with
 * `referrerUserId` so we can credit the sharer downstream.
 *
 * Why AsyncStorage and not a cookie: the marketplace mobile app is fully
 * native; there's no shared cookie jar with the web. We rely on Universal
 * Links / deep linking to surface the ref, then persist it locally.
 *
 * Why 30 days: long enough for buyers who browse for a while; short enough
 * to avoid stale attribution that game-fies the system.
 */
const KEY = "salepage:ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredRef {
  userId: string;
  code?: string;
  capturedAt: number;
}

export async function saveReferrer(input: {
  userId: string;
  code?: string;
}): Promise<void> {
  if (!input.userId || input.userId.length < 3) return;
  const payload: StoredRef = {
    userId: input.userId,
    code: input.code,
    capturedAt: Date.now(),
  };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Best-effort — never break a share link landing on a storage error.
  }
}

export async function getActiveReferrer(): Promise<{
  userId: string;
  code?: string;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRef;
    if (!parsed.userId) return null;
    if (Date.now() - parsed.capturedAt > TTL_MS) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    return { userId: parsed.userId, code: parsed.code };
  } catch {
    return null;
  }
}

export async function clearReferrer(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Append `?ref=<userId>` to an outgoing share URL if the current user has
 * one. Idempotent — won't double-append if the URL already has a ref.
 */
export function withReferrer(
  url: string,
  ref: { userId: string; code?: string } | null,
): string {
  if (!ref?.userId) return url;
  if (url.includes("ref=")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}ref=${encodeURIComponent(ref.userId)}`;
}
