import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  getPlatformLineLoginChannelId,
  getPlatformLineChannelSecret,
  verifyPlatformLineIdToken,
} from "@/lib/line";
import { signMobileJwt } from "@/lib/mobile-jwt";

/**
 * GET /api/v1/auth/mobile-bridge/line-callback?code=...&state=...
 *
 * LINE redirects here after the user grants access. We:
 *   1. Verify the cookie carries the same state LINE returned (CSRF).
 *   2. Exchange the auth code for an id_token + access_token (LINE's
 *      `/v2.1/token` endpoint needs the channel secret).
 *   3. Verify the id_token (re-uses verifyPlatformLineIdToken so we get
 *      the same email-resolution policy as the native line-mobile route).
 *   4. Find-or-create User by email (or synthetic LINE handle if email
 *      scope was not granted), mint mobile JWT, write to bridge row.
 *
 * Same User row as the native LINE PKCE flow + Google bridge + email
 * OTP — all four converge by lower-cased email.
 */
const COOKIE_NAME = "salepage_mb_line";
const LINE_TOKEN_ENDPOINT = "https://api.line.me/oauth2/v2.1/token";
const SYNTHETIC_DOMAIN = "line.salepage.in.th";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateFromLine = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const tag = `t=${Date.now().toString(36)}`;

  if (error) {
    return errorPage(`LINE returned error: ${error} [${tag}]`);
  }
  if (!code || !stateFromLine) {
    return errorPage(`Missing code/state from LINE callback [${tag}]`);
  }

  const jar = await cookies();
  const cookieVal = jar.get(COOKIE_NAME)?.value;
  if (!cookieVal) {
    return errorPage(`Missing bridge cookie [${tag}]`);
  }
  const [bridgeId, stateFromCookie] = cookieVal.split(":");
  if (!bridgeId || !stateFromCookie || stateFromCookie !== stateFromLine) {
    return errorPage(`State mismatch — possible CSRF [${tag}]`);
  }

  const row = await db.mobileAuthBridge.findUnique({ where: { id: bridgeId } });
  if (!row || row.expiresAt < new Date()) {
    return errorPage(`Sign-in window expired [${tag}]`);
  }
  if (row.consumedAt) {
    return errorPage(`This sign-in was already completed [${tag}]`);
  }

  const channelId = getPlatformLineLoginChannelId();
  const channelSecret = getPlatformLineChannelSecret();
  if (!channelId || !channelSecret) {
    return errorPage(`LINE not configured on this deployment [${tag}]`);
  }

  const callbackUrl = new URL(
    "/api/v1/auth/mobile-bridge/line-callback",
    url.origin,
  ).toString();

  try {
    // Exchange code → tokens
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: channelId,
      client_secret: channelSecret,
    });
    const tokenRes = await fetch(LINE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const tokenJson = (await tokenRes.json()) as {
      id_token?: string;
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenJson.id_token) {
      return errorPage(
        `Token exchange failed: ${tokenJson.error_description ?? tokenJson.error ?? "unknown"} [${tag}]`,
      );
    }

    // Verify + decode id_token (reuses the same primitive as line-mobile
    // so the email resolution policy matches)
    const profile = await verifyPlatformLineIdToken(tokenJson.id_token);

    const email = (profile.email ?? `${profile.sub}@${SYNTHETIC_DOMAIN}`)
      .toLowerCase()
      .trim();

    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name: profile.name ?? null,
          image: profile.picture ?? null,
        },
      });
    } else if (user.suspended) {
      return errorPage(`Account suspended [${tag}]`);
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

    // Single-use: clear cookie
    jar.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });

    return successPage();
  } catch (err) {
    console.error("[mobile-bridge/line-callback] threw:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return errorPage(`LINE sign-in failed: ${msg.slice(0, 200)} [${tag}]`);
  }
}

function successPage() {
  // Redirect to salepage://auth/line so openAuthSessionAsync resolves
  // and the in-app browser closes (mirrors the Google fix —
  // dismissBrowser() doesn't work for openAuthSessionAsync, only the
  // deep-link redirect does).
  const deepLink = "salepage://auth/line?ok=1";
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
  .check { width: 64px; height: 64px; border-radius: 50%; background: #06C755; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 4px 14px rgba(6,199,85,0.32); }
  .check svg { width: 30px; height: 30px; color: #fff; }
  h1 { font-size: 20px; margin: 0 0 8px; font-weight: 700; }
  p { color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
  .btn { display: inline-block; padding: 12px 24px; border-radius: 12px; background: #06C755; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; }
</style>
<script>
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
  setTimeout(function () {
    try { var a = document.getElementById('back'); if (a) a.click(); } catch (e) { /* ignore */ }
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
