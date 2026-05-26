import * as Linking from "expo-linking";
import { getEnv } from "@/lib/env";

/**
 * LINE sign-in for the SalePage mobile app via the server-side bridge.
 *
 * Same reasoning as the Google bridge in `mobile/src/lib/google-login.ts`:
 *   - Expo SDK 54 removed `useProxy` from expo-auth-session.
 *   - LINE's OAuth client needs the `salepage://auth/line` scheme to be
 *     registered, but Expo Go's bundle id is `host.exp.Exponent`. So
 *     native PKCE only works in EAS builds.
 *
 * The bridge runs the OAuth on the SalePage server (which already holds
 * the LINE channel secret) so this works identically in Expo Go AND EAS.
 *
 * Flow:
 *   1. POST /api/v1/auth/mobile-bridge/start { provider: "line" } → bridgeId + openUrl
 *   2. WebBrowser.openAuthSessionAsync(openUrl, "salepage://auth/line")
 *      opens the system browser to /mobile-bridge/line which 302s to
 *      LINE's authorize endpoint. After user grants access, LINE returns
 *      to /mobile-bridge/line-callback which mints a SalePage JWT.
 *   3. Concurrently poll /poll every 1.5s; on token receipt dismiss the
 *      browser and return the JWT.
 *
 * Same User row as the native flow + Google bridge + email-OTP: all
 * find-or-create by lower-cased email (or LINE-synthetic email when scope
 * was not granted).
 */

const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 5 * 60 * 1000;

export interface LineBridgeResult {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

export class LineLoginCancelledError extends Error {
  constructor() {
    super("LINE login cancelled by user");
    this.name = "LineLoginCancelledError";
  }
}

export class LineLoginTimeoutError extends Error {
  constructor() {
    super("LINE login timed out");
    this.name = "LineLoginTimeoutError";
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

export async function loginWithLine(): Promise<LineBridgeResult> {
  const env = getEnv();
  const apiBase = env.apiBaseUrl.replace(/\/+$/, "");

  const startRes = await fetch(`${apiBase}/api/v1/auth/mobile-bridge/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "line" }),
  });
  const startJson = (await startRes.json()) as ApiResp<{
    bridgeId: string;
    openUrl: string;
    expiresAt: string;
  }>;
  if (!startJson.ok) {
    throw new Error(startJson.error.message);
  }
  const { bridgeId } = startJson.data;

  // Build a return URL that picks the right scheme at runtime:
  //   Expo Go: `exp://192.168.x.x:8081/--/auth/line?ok=1`
  //   EAS:     `salepage://auth/line?ok=1`
  // The LIFF page deep-links here after auth so the user lands back
  // in the SalePage app without manually app-switching.
  const returnUrl = Linking.createURL("/auth/line?ok=1");
  const openUrl = `${apiBase}/api/v1/auth/mobile-bridge/line?bridge=${bridgeId}&return=${encodeURIComponent(returnUrl)}`;

  let cancelled = false;
  let pollHandle: ReturnType<typeof setTimeout> | null = null;
  let finalResult: LineBridgeResult | null = null;
  let finalError: Error | null = null;

  const pollPromise = new Promise<void>((resolve) => {
    const deadline = Date.now() + MAX_WAIT_MS;
    const tick = async () => {
      if (cancelled) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        finalError = new LineLoginTimeoutError();
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
              user: LineBridgeResult["user"];
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
        if (!json.ok && json.error.code === "bridge_expired") {
          finalError = new LineLoginTimeoutError();
          resolve();
          return;
        }
      } catch {
        // network blip — keep polling
      }
      pollHandle = setTimeout(tick, POLL_INTERVAL_MS);
    };
    void tick();
  });

  // 911korn 2026-05-26: SFSafariViewController (WebBrowser.openBrowserAsync)
  // does NOT auto-trigger Universal Links without an explicit user
  // gesture — so the liff.line.me redirect just opened access.line.me
  // inside the sheet and showed the email/password form instead of
  // launching the LINE app.
  //
  // Linking.openURL routes through the system Safari, which DOES respect
  // Universal Links automatically. iOS sees `https://liff.line.me/<id>`
  // and hands off to the LINE app immediately.
  //
  // Trade-off: the user is now in Safari (or LINE), not inside our
  // SafariViewController. They have to manually swipe back to SalePage
  // after LINE finishes. The poll keeps running in the background — by
  // the time the user returns, the JWT is already persisted.
  void Linking.openURL(openUrl);

  await pollPromise;

  if (finalResult) {
    cancelled = true;
    if (pollHandle) clearTimeout(pollHandle);
    return finalResult;
  }

  // Poll resolved without a token — timeout or hard error
  cancelled = true;
  if (pollHandle) clearTimeout(pollHandle);
  if (finalError) throw finalError;
  throw new LineLoginCancelledError();
}
