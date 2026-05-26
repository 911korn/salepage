import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlatformLineLiffId } from "@/lib/line";

/**
 * GET /api/v1/auth/mobile-bridge/line?bridge=ID
 *
 * 911korn 2026-05-26: "Login with LINE บังคับให้ไป LINE LIFF ของ
 * @salepage ไปเลย จะได้ไป แอดเพื่อนและเชื่อมต่อ LINE Connect ไปเลยด้วย".
 *
 * The previous OAuth-on-access.line.me approach was unreliable in
 * SFSafariViewController (didn't auto-launch the LINE app), and worse
 * — even on success it didn't add the user as a friend of the @salepage
 * Official Account, so we couldn't push them notifications via the
 * Messaging API.
 *
 * The fix: redirect the browser to the LIFF Universal Link
 * `https://liff.line.me/<LIFF_ID>?bridge=<bridgeId>`. iOS recognises
 * this as a LINE Universal Link and hands off to the LINE app. The LIFF
 * page (rendered at /auth/liff-line) handles login + access token
 * extraction + POST to our bridge endpoint. The friend-add prompt is
 * triggered by LIFF itself when the LIFF app's "Add friend option" is
 * enabled in the LINE Developers Console.
 *
 * No CSRF cookie needed any more — LIFF's access token is the auth
 * artefact, and we verify it server-side against our LINE channel id.
 */
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

  const liffId = getPlatformLineLiffId();
  if (!liffId) {
    return errorPage("LIFF not configured on this server.");
  }

  // Forward the bridge id + optional return URL via the LIFF URL query.
  // The LIFF SDK preserves these on the liff.login() roundtrip via
  // redirectUri, and our /auth/liff-line page parses them out of
  // `liff.state` to (a) verify the bridge and (b) deep-link the user
  // back to the SalePage native app after auth.
  const liffUrl = new URL(`https://liff.line.me/${liffId}`);
  liffUrl.searchParams.set("bridge", row.id);
  const returnUrl = url.searchParams.get("return");
  if (returnUrl) {
    liffUrl.searchParams.set("return", returnUrl);
  }

  return NextResponse.redirect(liffUrl);
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
