import Script from "next/script";

export const dynamic = "force-static";

/**
 * Fallback web page for /auth/google. Mirrors /auth/line — exists to
 * absorb any iOS Safari fallback when the `salepage://auth/google?ok=1`
 * deep link doesn't resolve cleanly.
 */
export default function AuthGoogleFallback() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SalePage — Signed in with Google</title>
        <style>{css}</style>
      </head>
      <body>
        <div className="card">
          <div className="check">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="msg">You&apos;re signed in. Returning to SalePage…</p>
          <div className="spinner" aria-hidden />
        </div>
        <Script
          id="reopen-app"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              setTimeout(() => {
                try { window.location.href = 'salepage://auth/google?ok=1'; } catch (e) {}
              }, 200);
            `,
          }}
        />
      </body>
    </html>
  );
}

const css = `
html, body { margin: 0; height: 100%; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; color: #111827; }
body { display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; }
.card { max-width: 320px; }
.check { width: 64px; height: 64px; border-radius: 50%; background: #10b981; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 4px 14px rgba(16,185,129,0.32); color: #fff; }
.check svg { width: 30px; height: 30px; }
.msg { font-size: 14px; line-height: 1.5; color: #6b7280; margin: 0 0 20px 0; }
.spinner { width: 36px; height: 36px; border-radius: 50%; border: 3px solid #e5e7eb; border-top-color: #111827; animation: spin 0.8s linear infinite; margin: 0 auto; }
@keyframes spin { to { transform: rotate(360deg); } }
`;
