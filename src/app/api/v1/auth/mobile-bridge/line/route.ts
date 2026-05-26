import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getPlatformLineLoginChannelId } from "@/lib/line";
import { randomBytes } from "node:crypto";

/**
 * GET /api/v1/auth/mobile-bridge/line?bridge=ID
 *
 * Native LINE PKCE in mobile/src/lib/line-login.ts redirects to
 * `salepage://auth/line`, but Expo Go's bundle id is `host.exp.Exponent`
 * so the OS doesn't register that scheme. The bridge runs the OAuth on
 * the server side: we 302 to LINE's authorize endpoint with our backend
 * as the redirect URI, set a cookie carrying the bridge id, and let the
 * /line-callback route handle the code exchange.
 *
 * Compared to Google bridge: simpler — LINE doesn't go through Auth.js,
 * so there's no CSRF auto-submit form. We hold the OAuth state in a
 * cookie + bridge row instead.
 */
const COOKIE_NAME = "salepage_mb_line";
const LINE_AUTH_ENDPOINT = "https://access.line.me/oauth2/v2.1/authorize";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bridgeId = url.searchParams.get("bridge");
  if (!bridgeId) return errorPage("Missing bridge id");

  const row = await db.mobileAuthBridge.findUnique({ where: { id: bridgeId } });
  if (!row || row.expiresAt < new Date()) {
    return errorPage("Sign-in link expired. Please retry from the app.");
  }
  if (row.consumedAt) {
    return errorPage("This sign-in link was already used.");
  }

  const channelId = getPlatformLineLoginChannelId();
  if (!channelId) {
    return errorPage("LINE login is not configured on this server.");
  }

  // Random CSRF state — verified by /line-callback. We carry it in the
  // cookie + in LINE's OAuth state param; both must match on return.
  const state = randomBytes(16).toString("base64url");

  const callbackUrl = new URL(
    "/api/v1/auth/mobile-bridge/line-callback",
    url.origin,
  ).toString();

  const lineUrl = new URL(LINE_AUTH_ENDPOINT);
  lineUrl.searchParams.set("response_type", "code");
  lineUrl.searchParams.set("client_id", channelId);
  lineUrl.searchParams.set("redirect_uri", callbackUrl);
  lineUrl.searchParams.set("state", state);
  lineUrl.searchParams.set("scope", "profile openid email");
  lineUrl.searchParams.set("bot_prompt", "normal");

  // 911korn 2026-05-26: "LINE ต้องทำให้ Auto redirect ออกไปแอพไลน์".
  // First attempt (initial_amr_display=lineqr) forced LINE into QR mode
  // which was the wrong direction. The real fix is to render a small
  // intermediate page that JavaScript-redirects to LINE's `line://` URL
  // scheme first — iOS sees the scheme is registered to the LINE app
  // and switches to it. We fall back to access.line.me/oauth/v2.1/
  // authorize for users without the LINE app installed.
  //
  // The fallback timer is intentionally short (250ms) so the user
  // doesn't see a flash of the launcher page on devices with LINE app
  // installed (iOS hands off almost instantly).
  const lineAppUrl = `line://oauth?${lineUrl.searchParams.toString()}`;
  const launcherHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Opening LINE...</title>
<style>
  html, body { margin: 0; height: 100%; background: #06C755; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; color: #ffffff; }
  body { display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; }
  .card { max-width: 320px; }
  h1 { font-size: 24px; margin: 0 0 8px 0; font-weight: 800; letter-spacing: 0.4px; }
  p { font-size: 14px; line-height: 1.5; margin: 0 0 20px 0; opacity: 0.95; }
  .spinner { width: 36px; height: 36px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.35); border-top-color: #ffffff; animation: spin 0.8s linear infinite; margin: 0 auto; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="card">
  <h1>LINE</h1>
  <p>Opening the LINE app...</p>
  <div class="spinner" aria-hidden="true"></div>
</div>
<script>
  // Try the app-scheme deep link first. iOS routes line:// to the LINE
  // app if installed; if not installed, the navigation no-ops and the
  // setTimeout below fires the web fallback.
  window.location.href = ${JSON.stringify(lineAppUrl)};
  setTimeout(() => {
    window.location.href = ${JSON.stringify(lineUrl.toString())};
  }, 350);
</script>
</body>
</html>`;

  const res = new NextResponse(launcherHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
  const jar = await cookies();
  // Cookie value is `<bridgeId>:<state>` — two ephemerals bound together
  // so a stolen cookie alone (without the state forwarded by LINE) can't
  // be replayed.
  jar.set(COOKIE_NAME, `${row.id}:${state}`, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return res;
}

function errorPage(message: string) {
  const safe = message.replace(/</g, "&lt;");
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>SalePage</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:32px 24px;color:#111827;text-align:center;}h1{font-size:18px;}p{color:#6b7280;font-size:14px;}</style></head><body><h1>Sign-in unavailable</h1><p>${safe}</p></body></html>`,
    {
      status: 400,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
