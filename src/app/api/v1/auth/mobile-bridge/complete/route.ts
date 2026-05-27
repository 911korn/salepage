import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { signMobileJwt } from "@/lib/mobile-jwt";

/**
 * GET /api/v1/auth/mobile-bridge/complete
 *
 * Auth.js redirects here after a successful OAuth callback. We read the
 * bridge cookie set by /mobile-bridge/google, mint a SalePage mobile JWT
 * for the now-signed-in user, store it on the bridge row, and render a
 * "you can close this and return to the app" page. The mobile app, which
 * has been polling /poll the entire time, picks up the token and dismisses
 * the system browser.
 */
const COOKIE_NAME = "salepage_mb_bridge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Top-level try-catch so any unexpected failure surfaces a visible
  // diagnostic page instead of a blank 500. 911korn 2026-05-26 reported
  // a white page after Google sign-in — the previous version threw before
  // rendering and Next's default error response is empty body.
  try {
    const jar = await cookies();
    const bridgeId = jar.get(COOKIE_NAME)?.value;
    // Diagnostic fingerprint so the user can paste/screenshot the error
    // page and we can pinpoint which branch fired.
    const tag = `t=${Date.now().toString(36)}`;
    if (!bridgeId) {
      return errorPage(
        `Missing bridge session. Please retry from the app. [${tag} no-cookie]`,
      );
    }

    const row = await db.mobileAuthBridge.findUnique({ where: { id: bridgeId } });
    if (!row) {
      return errorPage(`Bridge not found. Please retry from the app. [${tag} no-row]`);
    }
    if (row.expiresAt < new Date()) {
      return errorPage(
        `Sign-in window expired. Please retry from the app. [${tag} expired]`,
      );
    }
    if (row.consumedAt) {
      return errorPage(`This sign-in was already completed. [${tag} consumed]`);
    }

    const session = await auth();
    if (!session?.user?.id) {
      // This is the path 911korn saw — Auth.js callback fired but
      // session is missing. Most likely cause: the Google OAuth client
      // redirected to a different callback URL than the cookie
      // associates with, or Auth.js's session cookie isn't yet visible
      // to this request (cookie path mismatch).
      console.warn(
        `[mobile-bridge/complete] no session after OAuth callback`,
        { bridgeId, hasSession: Boolean(session), url: url.toString() },
      );
      return errorPage(
        `Google sign-in did not complete. Please close this window and try again. [${tag} no-session]`,
      );
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return errorPage(`Account not found. Please retry from the app. [${tag} no-user]`);
    }
    if (user.suspended) {
      return errorPage(`This account has been suspended. [${tag} suspended]`);
    }

    const { token, expiresAt } = await signMobileJwt({
      sub: user.id,
      email: user.email,
      v: 1,
    });

    await db.mobileAuthBridge.update({
      where: { id: row.id },
      data: { token, userId: user.id, expiresAt },
    });

    // Wipe the bridge cookie — single-use.
    jar.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });

    return successPage();
  } catch (err) {
    console.error("[mobile-bridge/complete] threw:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return errorPage(`Server error during sign-in: ${msg.slice(0, 200)}`);
  }
}

function successPage() {
  // Redirect to the salepage:// deep link so WebBrowser.openAuthSessionAsync
  // on the mobile side resolves with `type: "success"` and the system
  // browser closes automatically (911korn 2026-05-27 "ในแอพ มีปัญหากับ
  // Google Login มันค้างอยู่ใน modal ตอน Login success").
  //
  // Why the deep-link redirect is the right primitive:
  //   - `WebBrowser.dismissBrowser()` only works for `openBrowserAsync`,
  //     not `openAuthSessionAsync` — the latter only closes when the
  //     in-flight URL matches the deep-link argument we passed in.
  //   - Some iOS in-app browsers won't honour a `<meta refresh>` to a
  //     `salepage://` scheme without a user gesture, so we also expose a
  //     visible "Return to app" button as a fallback.
  //   - We attempt `window.location.replace` first because it works on
  //     Chrome/Safari mobile + Android browsers without confirmation.
  const deepLink = "salepage://auth/google?ok=1";
  // iOS SFAuthenticationSession sometimes blocks `window.location.replace`
  // to a custom URL scheme when fired from a setTimeout (it interprets
  // delayed navigation as not-user-initiated). The combination of HTTP
  // refresh-style meta tag + immediate inline script + visible <a>
  // covers every iOS / Android / SFSafariViewController variant we've
  // seen in the wild.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="refresh" content="0; url=${deepLink}" />
<title>Signed in - SalePage</title>
<style>
  html, body { margin: 0; height: 100%; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; color: #111827; }
  body { display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { max-width: 320px; text-align: center; }
  .check { width: 64px; height: 64px; border-radius: 50%; background: #10b981; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 4px 14px rgba(16,185,129,0.32); }
  .check svg { width: 30px; height: 30px; color: #fff; }
  h1 { font-size: 20px; margin: 0 0 8px; font-weight: 700; }
  p { color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
  .btn { display: inline-block; padding: 12px 24px; border-radius: 12px; background: #e11d48; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; }
</style>
<script>
  // Fire immediately during HTML parse — iOS allows custom-scheme
  // navigation during the initial document load, but blocks it from
  // scripts that run after onload when there was no user gesture.
  try { window.location.href = "${deepLink}"; } catch (e) { /* ignore */ }
</script>
</head>
<body>
<div class="card">
  <div class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
  <h1>You're signed in</h1>
  <p>Returning you to the SalePage app...</p>
  <a class="btn" href="${deepLink}" id="back">กลับสู่แอป</a>
</div>
<script>
  // Auto-click the button after 200ms as a third fallback — Safari
  // treats programmatic anchor clicks slightly differently from
  // location.replace and one of them usually goes through.
  setTimeout(function () {
    try {
      var a = document.getElementById('back');
      if (a) a.click();
    } catch (e) { /* ignore */ }
  }, 200);
</script>
</body>
</html>`;
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function errorPage(message: string) {
  const safe = message.replace(/</g, "&lt;");
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>SalePage</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:32px 24px;color:#111827;text-align:center;}h1{font-size:18px;margin:0 0 12px 0;}p{color:#6b7280;font-size:14px;line-height:1.6;margin:0;}code{font-family:'SF Mono',Menlo,monospace;font-size:11px;color:#a1a1aa;display:block;margin-top:16px;}</style></head><body><h1>Sign-in unavailable</h1><p>${safe}</p></body></html>`,
    {
      status: 400,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
