import Script from "next/script";

export const dynamic = "force-static";

/**
 * Fallback web page for /auth/line.
 *
 * The LIFF success page deep-links to `exp://...` / `salepage://...` to
 * bring the user back into the mobile app. iOS Safari / SFSafariView
 * sometimes briefly shows the URL as `https://salepage.in.th/auth/line?
 * ok=1` during the scheme-handoff transition, which used to surface as
 * Next.js's default 404 (911korn 2026-05-26 screenshot).
 *
 * This page renders a friendly "you're signed in, return to the app"
 * screen with a JavaScript-fired custom-scheme redirect so iOS Safari
 * has a second chance to hand off. No 404 surface ever appears.
 */
export default function AuthLineFallback() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SalePage — Signed in with LINE</title>
        <style>{css}</style>
      </head>
      <body>
        <div className="card">
          <div className="logo">LINE</div>
          <p className="msg">You&apos;re signed in. Returning to SalePage…</p>
          <div className="spinner" aria-hidden />
        </div>
        <Script
          id="reopen-app"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              setTimeout(() => {
                try { window.location.href = 'salepage://auth/line?ok=1'; } catch (e) {}
              }, 200);
            `,
          }}
        />
      </body>
    </html>
  );
}

const css = `
html, body { margin: 0; height: 100%; background: #06C755; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; color: #ffffff; }
body { display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; }
.card { max-width: 320px; }
.logo { font-size: 32px; font-weight: 900; letter-spacing: 0.6px; margin-bottom: 18px; }
.msg { font-size: 14px; line-height: 1.5; margin: 0 0 20px 0; opacity: 0.95; }
.spinner { width: 36px; height: 36px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.35); border-top-color: #ffffff; animation: spin 0.8s linear infinite; margin: 0 auto; }
@keyframes spin { to { transform: rotate(360deg); } }
`;
