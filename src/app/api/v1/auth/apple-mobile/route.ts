import { z } from "zod";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { signMobileJwt } from "@/lib/mobile-jwt";

/**
 * POST /api/v1/auth/apple-mobile
 *
 * Body: { idToken, fullName?, email? }
 *   - idToken: identityToken from expo-apple-authentication.signInAsync()
 *   - fullName: Apple ONLY returns the user's name on the FIRST sign-in
 *     attempt per device. Mobile must capture it then and forward here so
 *     we can seed the User row.
 *   - email: similarly, only present on first sign-in OR when the user
 *     opts to share their real address. If the user picked "Hide my
 *     email", Apple gives us a relay address — we still accept it.
 *
 * Verifies the identityToken against Apple's JWKS at
 * https://appleid.apple.com/auth/keys, validates audience = our bundle
 * identifier, finds-or-creates the user, returns a SalePage JWT.
 *
 * Apple Sign In is a mandatory App Review requirement (Guideline 4.8)
 * for any app that offers third-party social login, which we do
 * (Google + LINE).
 */
const Body = z.object({
  idToken: z.string().min(10).max(5000),
  fullName: z
    .object({
      givenName: z.string().max(80).nullable().optional(),
      familyName: z.string().max(80).nullable().optional(),
    })
    .optional(),
  email: z.string().email().max(200).optional(),
});

interface AppleClaims {
  iss: string;
  aud: string;
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  is_private_email?: string | boolean;
  exp: number;
}

const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  let claims: AppleClaims;
  try {
    claims = await verifyAppleIdToken(parsed.data.idToken);
  } catch (err) {
    return fail(
      "apple_token_invalid",
      err instanceof Error ? err.message : "Apple identityToken ไม่ถูกต้อง",
      401,
    );
  }

  // Prefer the email Apple signed into the JWT; fall back to the body's
  // email field which the client captures only on the first sign-in.
  const email =
    claims.email?.toLowerCase().trim() ??
    parsed.data.email?.toLowerCase().trim() ??
    null;
  if (!email) {
    return fail(
      "email_missing",
      "Apple ไม่ส่ง email มา · ลองเปิด \"Share My Email\" ในขั้นตอน Sign in with Apple",
      401,
    );
  }

  const displayName =
    [parsed.data.fullName?.givenName, parsed.data.fullName?.familyName]
      .filter(Boolean)
      .join(" ")
      .trim() || null;

  const existing = await db.user.findUnique({ where: { email } });
  let user = existing;
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: displayName,
        image: null,
      },
    });
  } else if (user.suspended) {
    return fail("suspended", "บัญชีนี้ถูกระงับ", 403);
  } else if (displayName && !user.name) {
    // First-time Apple sign-in landing on an account that was previously
    // created without a name (e.g. email-OTP). Backfill it.
    user = await db.user.update({
      where: { id: user.id },
      data: { name: displayName },
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

async function verifyAppleIdToken(idToken: string): Promise<AppleClaims> {
  // The aud field on Apple identity tokens for the iOS native flow is the
  // bundle identifier of the requesting app. We accept multiple aud values
  // so both the iOS app and a future web Apple-Service-ID flow can hit
  // this endpoint. Defaults cover the SalePage bundle id.
  const allowedAuds = (
    process.env.APPLE_SIGNIN_AUDIENCES ??
    process.env.APPLE_SIGNIN_AUDIENCE ??
    "in.th.salepage.mobile"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
    issuer: "https://appleid.apple.com",
    audience: allowedAuds,
  });

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Apple identityToken missing sub");
  }
  return payload as unknown as AppleClaims;
}
