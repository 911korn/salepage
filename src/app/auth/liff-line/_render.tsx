import Script from "next/script";

export const liffBaseCss = `
html, body { margin: 0; height: 100%; background: #06C755; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; color: #ffffff; }
body { display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; }
.card { max-width: 320px; }
.logo { font-size: 32px; font-weight: 900; letter-spacing: 0.6px; margin-bottom: 18px; }
.msg { font-size: 14px; line-height: 1.5; margin: 0 0 20px 0; opacity: 0.95; }
.spinner { width: 36px; height: 36px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.35); border-top-color: #ffffff; animation: spin 0.8s linear infinite; margin: 0 auto; }
@keyframes spin { to { transform: rotate(360deg); } }
`;

/**
 * Deep-link bootstrap — initialises LIFF so the user's existing LINE app
 * session establishes a profile + access token (gives us the "Auto Login
 * พร้อมซื้อ" behaviour 911korn asked for), then redirects to the target
 * URL with the `sp_liff=1` marker.
 *
 * If the user somehow isn't logged into LINE on this device, we still
 * call liff.login() with the same target as the redirectUri so they come
 * back here after auth and complete the bounce.
 */
export function liffDeepLinkRedirectJs(liffId: string, targetHref: string): string {
  return `
(async () => {
  const setMsg = (t) => { const el = document.getElementById('msg'); if (el) el.textContent = t; };
  const go = () => { try { window.location.replace(${JSON.stringify(targetHref)}); } catch (e) { /* ignore */ } };
  try {
    if (!window.liff) { go(); return; }
    await window.liff.init({ liffId: ${JSON.stringify(liffId)}, withLoginOnExternalBrowser: true });
    if (!window.liff.isLoggedIn()) {
      // LINE app session not active in this LIFF window; bounce through
      // liff.login() and we'll re-enter this script after auth.
      window.liff.login({ redirectUri: window.location.href });
      return;
    }
    setMsg('พร้อมแล้ว — กำลังพาไปหน้าสินค้า…');
    go();
  } catch (e) {
    // Whatever broke, the buyer should still get to the target page —
    // the page's own LineLiffBootstrap will retry the LIFF handshake.
    go();
  }
})();
`;
}

/**
 * Shared "Connecting back to SalePage…" page used by both the liff.state
 * deep-link branch (`/auth/liff-line?liff.state=...`) and the path-suffix
 * catchall (`/auth/liff-line/<...path>`). Renders the LIFF SDK + the
 * redirect bootstrap that fires once LIFF init resolves.
 */
export function LiffDeepLinkRedirectPage({
  liffId,
  targetHref,
}: {
  liffId: string;
  targetHref: string;
}) {
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
          <p className="msg" id="msg">
            กำลังพาคุณกลับเข้าหน้า SalePage…
          </p>
          <div className="spinner" aria-hidden />
        </div>
        <Script
          src="https://static.line-scdn.net/liff/edge/2/sdk.js"
          strategy="beforeInteractive"
        />
        <Script
          id="liff-redirect"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: liffDeepLinkRedirectJs(liffId, targetHref),
          }}
        />
      </body>
    </html>
  );
}
