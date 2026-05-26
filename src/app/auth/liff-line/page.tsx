import Script from "next/script";
import { getPlatformLineLiffId } from "@/lib/line";

export const dynamic = "force-dynamic";

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

  if (!bridge) return <ErrorBlock message="Missing bridge id." />;
  if (!liffId)
    return <ErrorBlock message="LIFF not configured on this deployment." />;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SalePage — Sign in with LINE</title>
        <style>{baseCss}</style>
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

function ErrorBlock({ message }: { message: string }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SalePage</title>
        <style>{baseCss}</style>
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

const baseCss = `
html, body { margin: 0; height: 100%; background: #06C755; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; color: #ffffff; }
body { display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; }
.card { max-width: 320px; }
.logo { font-size: 32px; font-weight: 900; letter-spacing: 0.6px; margin-bottom: 18px; }
.msg { font-size: 14px; line-height: 1.5; margin: 0 0 20px 0; opacity: 0.95; }
.spinner { width: 36px; height: 36px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.35); border-top-color: #ffffff; animation: spin 0.8s linear infinite; margin: 0 auto; }
@keyframes spin { to { transform: rotate(360deg); } }
`;
