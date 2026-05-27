import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * GET /api/v1/auth/mobile-bridge/google?bridge=ID
 *
 * Entry point the mobile app opens in the system browser. Validates the
 * bridge row, stashes its id in a short-lived cookie, then auto-submits a
 * POST into Auth.js's normal Google sign-in. After Auth.js finishes, it'll
 * send the browser to /api/v1/auth/mobile-bridge/complete which reads the
 * cookie and mints the mobile JWT.
 *
 * Why auto-submitting HTML instead of a plain 302:
 *   - Auth.js v5 requires a CSRF token when initiating OAuth via POST.
 *   - The token is set on a cookie by /api/auth/csrf. We fetch it client-side
 *     and submit a hidden form — the browser then follows Auth.js's normal
 *     302 chain into Google, the user signs in, Google bounces back to
 *     /api/auth/callback/google, Auth.js creates/links the user, then 302s
 *     to /api/v1/auth/mobile-bridge/complete.
 */
const COOKIE_NAME = "salepage_mb_bridge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bridgeId = url.searchParams.get("bridge");
  if (!bridgeId) {
    return errorPage("Missing bridge id", url.origin);
  }

  const row = await db.mobileAuthBridge.findUnique({ where: { id: bridgeId } });
  if (!row || row.expiresAt < new Date()) {
    return errorPage("Login link expired. Please try again from the app.", url.origin);
  }
  if (row.consumedAt) {
    return errorPage("This login link was already used.", url.origin);
  }

  const callbackUrl = new URL(
    "/api/v1/auth/mobile-bridge/complete",
    url.origin,
  ).toString();

  const html = autoSubmitHtml({
    callbackUrl,
    origin: url.origin,
  });
  const res = new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
  const jar = await cookies();
  jar.set(COOKIE_NAME, row.id, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  // 911korn 2026-05-28: "เลือกเมลอื่นแต่ก็เป็นเมลเดิมตลอด — Session
  // เดิมไม่เคลีย". If the WebBrowser cookie jar already has a NextAuth
  // session from a prior sign-in (non-ephemeral system browser on
  // iOS), the OAuth callback re-binds to that session instead of
  // creating a new one. Nuke every NextAuth cookie at this origin
  // before the auto-submit fires so the OAuth roundtrip is always
  // fresh. Mirrors the mobile-side `preferEphemeralSession: true`.
  const isHttps = url.protocol === "https:";
  for (const name of [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "authjs.pkce.code_verifier",
    "__Secure-authjs.pkce.code_verifier",
    "authjs.state",
    "__Secure-authjs.state",
  ]) {
    jar.set(name, "", {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}

function autoSubmitHtml({
  callbackUrl,
  origin,
}: {
  callbackUrl: string;
  origin: string;
}) {
  const escapedCallback = JSON.stringify(callbackUrl);
  const escapedOrigin = JSON.stringify(origin);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Signing in to SalePage</title>
<style>
  html, body { margin: 0; height: 100%; background: #ffffff; }
  body { display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; color: #111827; }
  .card { text-align: center; padding: 24px; }
  .spinner { width: 32px; height: 32px; border-radius: 50%; border: 3px solid #e5e7eb; border-top-color: #111827; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .label { font-size: 14px; color: #6b7280; }
</style>
</head>
<body>
<div class="card">
  <div class="spinner" aria-hidden="true"></div>
  <div class="label">Redirecting to Google...</div>
</div>
<script>
(async () => {
  try {
    const csrfRes = await fetch(${escapedOrigin} + "/api/auth/csrf", { credentials: "include" });
    const { csrfToken } = await csrfRes.json();
    const form = document.createElement("form");
    form.method = "POST";
    form.action = ${escapedOrigin} + "/api/auth/signin/google";
    const csrfInput = document.createElement("input");
    csrfInput.type = "hidden";
    csrfInput.name = "csrfToken";
    csrfInput.value = csrfToken;
    form.appendChild(csrfInput);
    const cbInput = document.createElement("input");
    cbInput.type = "hidden";
    cbInput.name = "callbackUrl";
    cbInput.value = ${escapedCallback};
    form.appendChild(cbInput);
    document.body.appendChild(form);
    form.submit();
  } catch (err) {
    document.querySelector(".label").textContent = "Failed to start Google sign-in. Please close this window and try again.";
  }
})();
</script>
</body>
</html>`;
}

function errorPage(message: string, origin: string) {
  const safe = message.replace(/</g, "&lt;");
  void origin;
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>SalePage</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:32px;color:#111827;text-align:center;}h1{font-size:18px;}p{color:#6b7280;font-size:14px;}</style></head><body><h1>Sign-in unavailable</h1><p>${safe}</p></body></html>`,
    {
      status: 400,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
