import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { signMobileJwt } from "@/lib/mobile-jwt";

/**
 * POST /api/v1/auth/google-mobile
 *
 * Body: { idToken: string }   ← from Google OAuth PKCE flow in the mobile app
 *
 * Verifies the id_token against Google's tokeninfo endpoint (which validates
 * signature + expiry + issuer for us), then finds-or-creates a User keyed
 * by the verified Google email. Returns a SalePage JWT.
 *
 * Audience whitelist:
 *   - GOOGLE_OAUTH_IOS_CLIENT_ID (id_tokens minted by the native iOS app)
 *   - GOOGLE_OAUTH_ANDROID_CLIENT_ID (later, when we ship Android signing)
 *   - AUTH_GOOGLE_ID (web Auth.js Google provider, in case the mobile bridge
 *     ever forwards a web-issued token)
 * Any other aud → reject. This stops a malicious app from minting a Google
 * token for its own client_id and passing it to our endpoint.
 */
const Body = z.object({
  idToken: z.string().min(10).max(5000),
});

interface GoogleTokenInfo {
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
  exp: string | number;
  error?: string;
  error_description?: string;
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  let profile: GoogleTokenInfo;
  try {
    profile = await verifyGoogleIdToken(parsed.data.idToken);
  } catch (err) {
    return fail(
      "google_token_invalid",
      err instanceof Error ? err.message : "Google id_token ไม่ถูกต้อง",
      401,
    );
  }

  if (
    profile.email_verified !== true &&
    profile.email_verified !== "true"
  ) {
    return fail(
      "email_not_verified",
      "Email ของบัญชี Google ยังไม่ได้รับการยืนยัน",
      401,
    );
  }
  const email = profile.email?.toLowerCase().trim();
  if (!email) {
    return fail("email_missing", "ไม่พบ email ใน Google id_token", 401);
  }

  const existing = await db.user.findUnique({ where: { email } });
  let user = existing;
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: profile.name ?? null,
        image: profile.picture ?? null,
      },
    });
  } else if (user.suspended) {
    return fail("suspended", "บัญชีนี้ถูกระงับ", 403);
  } else if (
    (profile.name && profile.name !== user.name) ||
    (profile.picture && profile.picture !== user.image)
  ) {
    // Sync display name + picture if the user hasn't customised them. Avoid
    // overwriting non-null values so users who edited their profile on the
    // web keep those overrides.
    user = await db.user.update({
      where: { id: user.id },
      data: {
        name: user.name ?? profile.name ?? null,
        image: user.image ?? profile.picture ?? null,
      },
    });
  }

  const { token, expiresAt } = await signMobileJwt({
    sub: user.id,
    email: user.email,
    v: 1,
  });

  return ok({
    token,
    expiresAt: expiresAt.toISOString(),
    userId: user.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
  });
}

/**
 * Verify a Google id_token via Google's tokeninfo endpoint. The endpoint
 * validates signature + expiry + issuer, then returns the decoded claims.
 *
 * We additionally enforce:
 *   - `iss` is `accounts.google.com` or `https://accounts.google.com`
 *   - `aud` matches one of our registered OAuth client IDs
 */
async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenInfo> {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google tokeninfo HTTP ${res.status}`);
  }
  const info = (await res.json()) as GoogleTokenInfo;
  if (info.error) {
    throw new Error(info.error_description ?? info.error);
  }
  if (!info.sub) {
    throw new Error("Google tokeninfo returned no subject");
  }
  if (
    info.iss !== "accounts.google.com" &&
    info.iss !== "https://accounts.google.com"
  ) {
    throw new Error(`Unexpected Google id_token iss: ${info.iss}`);
  }
  const allowedAuds = [
    process.env.GOOGLE_OAUTH_IOS_CLIENT_ID,
    process.env.GOOGLE_OAUTH_ANDROID_CLIENT_ID,
    process.env.AUTH_GOOGLE_ID,
  ].filter((v): v is string => Boolean(v));
  if (allowedAuds.length === 0) {
    throw new Error(
      "No Google OAuth client IDs configured on this deployment",
    );
  }
  if (!allowedAuds.includes(info.aud)) {
    throw new Error(`id_token aud ${info.aud} is not whitelisted`);
  }
  const expSec = typeof info.exp === "string" ? parseInt(info.exp, 10) : info.exp;
  if (Number.isFinite(expSec) && expSec * 1000 < Date.now()) {
    throw new Error("id_token expired");
  }
  return info;
}
