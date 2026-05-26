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
  const jar = await cookies();
  const bridgeId = jar.get(COOKIE_NAME)?.value;
  if (!bridgeId) {
    return errorPage("Missing bridge session. Please retry from the app.");
  }

  const row = await db.mobileAuthBridge.findUnique({ where: { id: bridgeId } });
  if (!row || row.expiresAt < new Date()) {
    return errorPage("Sign-in window expired. Please retry from the app.");
  }
  if (row.consumedAt) {
    return errorPage("This sign-in was already completed.");
  }

  const session = await auth();
  if (!session?.user?.id) {
    return errorPage(
      "Google sign-in did not complete. Please close this and try again.",
    );
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return errorPage("Account not found. Please retry from the app.");
  }
  if (user.suspended) {
    return errorPage("This account has been suspended.");
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

  return successPage(url.origin);
}

function successPage(origin: string) {
  void origin;
  // Try the custom-scheme deep link to auto-close the in-app browser. Many
  // platforms ignore it; we always render the visible "Return to app" CTA
  // as a fallback, and the mobile app dismisses the browser itself once
  // /poll returns the token.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Signed in - SalePage</title>
<style>
  html, body { margin: 0; height: 100%; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; color: #111827; }
  body { display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { max-width: 320px; text-align: center; }
  .check { width: 56px; height: 56px; border-radius: 50%; background: #10b981; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; }
  .check svg { width: 28px; height: 28px; color: #fff; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
  a.btn { display: inline-block; background: #111827; color: #fff; padding: 12px 20px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px; }
</style>
</head>
<body>
<div class="card">
  <div class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
  <h1>You're signed in</h1>
  <p>Return to the SalePage app to continue. This window will close automatically.</p>
  <a class="btn" href="salepage://auth/google?ok=1">Return to app</a>
</div>
<script>
  setTimeout(() => { location.href = "salepage://auth/google?ok=1"; }, 200);
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
