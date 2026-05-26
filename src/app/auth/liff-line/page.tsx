import Script from "next/script";
import { getPlatformLineLiffId } from "@/lib/line";
import {
  LIFF_RETURN_PARAM,
  resolveLiffStateTarget,
} from "@/lib/liff-url";
import { headers } from "next/headers";
import { LiffDeepLinkRedirectPage, liffBaseCss } from "./_render";

export const dynamic = "force-dynamic";

/**
 * Pick a safe base origin for resolveLiffStateTarget. We can't import
 * `webBaseUrl` env here (it's not always set in preview deployments) so
 * we read the inbound Host header.
 */
async function getBaseOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "salepage.in.th";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * /auth/liff-line?bridge=<id>
 *
 * LIFF auth page — opened in the LINE app's in-app browser via the
 * Universal Link `https://liff.line.me/<LIFF_ID>?bridge=...`. The LIFF
 * SDK gives us:
 *   - liff.login()              → if not logged in, redirects through
 *                                  LINE's app-to-app login (no QR, no
 *                                  password — just LINE's existing
 *                                  session)
 *   - liff.getAccessToken()     → access token we POST to our bridge
 *                                  endpoint
 *   - liff.getProfile()         → display name + userId (we also fetch
 *                                  this on the server for verification)
 *   - liff.closeWindow()        → dismisses the LIFF window so the user
 *                                  goes straight back to the app
 *
 * Friend-add: configured server-side in the LINE Developers Console
 * (LIFF app settings → "Add friend option"). When that's enabled, just
 * opening this page asks the user "Add @salepage as friend?" before
 * proceeding — no code needed here.
 *
 * 911korn 2026-05-26: "Login with LINE บังคับให้ไป LINE LIFF ของ
 * @salepage ไปเลย จะได้ไป แอดเพื่อนและเชื่อมต่อ LINE Connect ไปเลยด้วย"
 */
export default async function LiffLinePage({
  searchParams,
}: {
  searchParams: Promise<{
    bridge?: string;
    return?: string;
    "liff.state"?: string;
  }>;
}) {
  const sp = await searchParams;
  // LIFF rewrites the user-facing URL `https://liff.line.me/<id>?bridge=X
  // &return=Y` into our endpoint URL with the original query encoded as
  // `?liff.state=%3Fbridge%3DX%26return%3DY`. We try direct params first
  // (handy for desktop testing) then fall back to parsing liff.state.
  let bridge = sp.bridge ?? null;
  let returnUrl = sp.return ?? null;
  if ((!bridge || !returnUrl) && sp["liff.state"]) {
    try {
      const decoded = decodeURIComponent(sp["liff.state"]);
      const q = decoded.includes("?")
        ? decoded.slice(decoded.indexOf("?") + 1)
        : decoded.replace(/^\?/, "");
      const params = new URLSearchParams(q);
      bridge ??= params.get("bridge");
      returnUrl ??= params.get("return");
    } catch {
      /* fall through with whatever we got */
    }
  }

  const liffId = getPlatformLineLiffId();
  if (!liffId)
    return <ErrorBlock message="LIFF not configured on this deployment." />;

  // Bridge mode — used by the mobile app's "Login with LINE" flow.
  // Unchanged; absolutely do not break this path (911korn 2026-05-27
  // "ดูดีๆอย่าให้ กระทบ LINE Login นะ").
  if (bridge) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>SalePage — Sign in with LINE</title>
          <style>{liffBaseCss}</style>
        </head>
        <body>
          <div className="card">
            <div className="logo">LINE</div>
            <p className="msg" id="msg">
              Connecting your LINE account…
            </p>
            <div className="spinner" aria-hidden />
          </div>
          <Script
            src="https://static.line-scdn.net/liff/edge/2/sdk.js"
            strategy="beforeInteractive"
          />
          <Script
            id="liff-bootstrap"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: bootstrapJs(liffId, bridge, returnUrl),
            }}
          />
        </body>
      </html>
    );
  }

  // Deep-link mode — the page was reached via a LIFF redirect from a LINE
  // chat link (e.g. an order-status notification from the bot). No bridge
  // present, but `liff.state` carries the original target path. Init LIFF
  // so the user gets the auto-login through LINE's existing session, then
  // bounce them to the real destination (911korn 2026-05-27 screenshot
  // 04:24 "Missing bridge id. · ปกติมันต้อง Auto Login พร้อมซื้อ").
  const origin = await getBaseOrigin();
  const target = resolveLiffStateTarget(sp["liff.state"], `${origin}/auth/liff-line`);
  if (target && !target.pathname.startsWith("/auth/liff-line")) {
    // Tag the redirect URL with `sp_liff=1` so `LineLiffBootstrap` on the
    // destination page skips its own LIFF redirect — otherwise we'd ping-
    // pong back here forever.
    target.searchParams.set(LIFF_RETURN_PARAM, "1");
    return (
      <LiffDeepLinkRedirectPage liffId={liffId} targetHref={target.toString()} />
    );
  }

  // No bridge AND no resolvable target — explicit error so we don't loop.
  return <ErrorBlock message="Missing bridge id." />;
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SalePage</title>
        <style>{liffBaseCss}</style>
      </head>
      <body>
        <div className="card">
          <div className="logo">LINE</div>
          <p className="msg">{message}</p>
        </div>
      </body>
    </html>
  );
}

function bootstrapJs(
  liffId: string,
  bridge: string,
  returnUrl: string | null,
): string {
  // Default to the salepage:// scheme so EAS prod builds still get the
  // auto-return even when the mobile app forgot to pass `return`.
  const finalReturnUrl = returnUrl ?? "salepage://auth/line?ok=1";
  return `
(async () => {
  const setMsg = (t) => { const el = document.getElementById('msg'); if (el) el.textContent = t; };
  try {
    if (!window.liff) {
      setMsg('LINE SDK failed to load. Please retry from the app.');
      return;
    }
    await window.liff.init({ liffId: ${JSON.stringify(liffId)} });
    if (!window.liff.isLoggedIn()) {
      // Triggers LINE app's native login. No QR / password.
      window.liff.login({ redirectUri: window.location.href });
      return;
    }
    const accessToken = window.liff.getAccessToken();
    if (!accessToken) {
      setMsg("Couldn't read LINE access token. Please retry.");
      return;
    }
    const res = await fetch('/api/v1/auth/mobile-bridge/line-liff', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bridgeId: ${JSON.stringify(bridge)}, accessToken }),
    });
    const json = await res.json();
    if (!json.ok) {
      setMsg('Sign-in failed: ' + (json.error?.message || 'Unknown error'));
      return;
    }
    setMsg('Signed in! Returning to SalePage…');
    // Deep-link back to the SalePage native app so the user doesn't
    // have to manually swipe from LINE → SalePage (911korn 2026-05-26
    // "ไม่ยอม Back กลับมาแอพเอง ต้อง กด กลับมาเอง"). In EAS production
    // builds the salepage:// scheme is registered and iOS hands off
    // immediately; in Expo Go the scheme is unrecognised and the navigation
    // no-ops — closeWindow() then puts the user back on the LINE chat
    // list and they swipe back manually (acceptable for dev).
    setTimeout(() => {
      try {
        window.location.href = ${JSON.stringify(finalReturnUrl)};
      } catch (e) { /* ignore */ }
      setTimeout(() => {
        try { window.liff.closeWindow(); } catch (e) { /* ignore */ }
      }, 600);
    }, 300);
  } catch (err) {
    setMsg('LINE sign-in error: ' + (err && err.message ? err.message : String(err)));
  }
})();
`;
}

