import * as WebBrowser from "expo-web-browser";
import { getEnv } from "@/lib/env";

/**
 * Google sign-in for the SalePage mobile app via the server-side bridge.
 *
 * Why a bridge instead of native PKCE:
 *   - Expo SDK 54 removed `useProxy` from expo-auth-session, so the legacy
 *     "Web OAuth client with Expo proxy" workaround no longer compiles.
 *   - Google's iOS / Android client types require the binary's bundle ID
 *     to match exactly. Expo Go uses `host.exp.Exponent`, so native PKCE
 *     against `in.th.salepage.mobile` is impossible inside Expo Go.
 *   - The bridge sidesteps both: the user signs in on the web through the
 *     EXACT same Auth.js Google provider the web uses, which guarantees
 *     they land on the same SalePage `User` row keyed by lower-cased email.
 *
 * Flow:
 *   1. POST /api/v1/auth/mobile-bridge/start → { bridgeId, openUrl }
 *   2. WebBrowser.openAuthSessionAsync(openUrl, "salepage://auth/google")
 *      opens the system browser and waits for either the deep-link return
 *      or the user manually dismissing it.
 *   3. Concurrently poll GET /api/v1/auth/mobile-bridge/poll?bridge=ID
 *      every 1.5s. When the server returns `{ pending: false, token }`,
 *      dismiss the browser and return the token to the caller.
 *
 * Works identically in Expo Go and EAS production builds. No platform
 * differences, no native OAuth client setup required.
 */

const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 5 * 60 * 1000; // 5 min — matches server-side bridge TTL

export interface GoogleBridgeResult {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

export class GoogleLoginCancelledError extends Error {
  constructor() {
    super("Google login cancelled by user");
    this.name = "GoogleLoginCancelledError";
  }
}

export class GoogleLoginTimeoutError extends Error {
  constructor() {
    super("Google login timed out");
    this.name = "GoogleLoginTimeoutError";
  }
}

interface ApiOk<T> {
  ok: true;
  data: T;
}
interface ApiErr {
  ok: false;
  error: { code: string; message: string };
}
type ApiResp<T> = ApiOk<T> | ApiErr;

export async function loginWithGoogle(): Promise<GoogleBridgeResult> {
  const env = getEnv();
  const apiBase = env.apiBaseUrl.replace(/\/+$/, "");

  const startRes = await fetch(`${apiBase}/api/v1/auth/mobile-bridge/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "google" }),
  });
  const startJson = (await startRes.json()) as ApiResp<{
    bridgeId: string;
    openUrl: string;
    expiresAt: string;
  }>;
  if (!startJson.ok) {
    throw new Error(startJson.error.message);
  }
  const { bridgeId, openUrl } = startJson.data;

  let cancelled = false;
  let pollHandle: ReturnType<typeof setTimeout> | null = null;
  let finalResult: GoogleBridgeResult | null = null;
  let finalError: Error | null = null;

  const pollPromise = new Promise<void>((resolve) => {
    const deadline = Date.now() + MAX_WAIT_MS;
    const tick = async () => {
      if (cancelled) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        finalError = new GoogleLoginTimeoutError();
        resolve();
        return;
      }
      try {
        const res = await fetch(
          `${apiBase}/api/v1/auth/mobile-bridge/poll?bridge=${encodeURIComponent(bridgeId)}`,
        );
        const json = (await res.json()) as ApiResp<
          | { pending: true }
          | {
              pending: false;
              token: string;
              expiresAt: string;
              user: GoogleBridgeResult["user"];
            }
        >;
        if (json.ok && json.data.pending === false) {
          finalResult = {
            token: json.data.token,
            expiresAt: json.data.expiresAt,
            user: json.data.user,
          };
          resolve();
          return;
        }
        if (!json.ok) {
          if (json.error.code === "bridge_expired") {
            finalError = new GoogleLoginTimeoutError();
            resolve();
            return;
          }
          // Other errors are non-fatal — keep polling; the row may still be
          // pending and a transient 5xx shouldn't blow up the whole flow.
        }
      } catch {
        // Network blip — keep polling.
      }
      pollHandle = setTimeout(tick, POLL_INTERVAL_MS);
    };
    void tick();
  });

  // openBrowserAsync's promise resolves IMMEDIATELY on iOS with
  // `{ type: 'opened' }` — it doesn't wait for the browser to close.
  // So we deliberately ignore the browser promise and just wait for
  // the poll to win (or time out at MAX_WAIT_MS = 5 min).
  //
  // Cancellation detection: bridge row TTL is 5 min server-side, so
  // if the user dismisses the browser without finishing OAuth, the
  // poll keeps running until the row expires → server returns
  // `bridge_expired` → we throw GoogleLoginTimeoutError.
  void WebBrowser.openBrowserAsync(openUrl, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    dismissButtonStyle: "close",
  });

  await pollPromise;

  cancelled = true;
  if (pollHandle) clearTimeout(pollHandle);

  // Always try to dismiss the browser — if the user is still on the
  // success page when poll completes, this brings them back to the app.
  try {
    await WebBrowser.dismissBrowser();
  } catch {
    // No browser open or already dismissed — safe to ignore.
  }

  if (finalResult) return finalResult;
  if (finalError) throw finalError;
  throw new GoogleLoginCancelledError();
}
