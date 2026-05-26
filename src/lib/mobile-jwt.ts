import "server-only";
import { SignJWT, jwtVerify } from "jose";

/**
 * JWT for the SalePage mobile app.
 *
 * Why a separate JWT instead of NextAuth's database session:
 *  - The mobile app posts `Authorization: Bearer <jwt>` to /api/v1/* — we'd
 *    need cookie-bridging tooling to make NextAuth's database adapter accept
 *    a header, which is non-trivial and gets fragile across SDK upgrades.
 *  - Edge-runtime friendly: `jose` works in middleware (proxy.ts) and in
 *    every Route Handler regardless of runtime, no Node crypto dependency.
 *
 * Tokens are HS256-signed with `MOBILE_JWT_SECRET` (must be >= 32 random bytes).
 * Set in Vercel env. Same secret across web + native (mobile only verifies on
 * server; native side stores opaque token without validating signature).
 *
 * Lifetime:
 *  - Access token: 7 days. (Mobile renews automatically via /auth/refresh.)
 *  - We don't issue separate refresh tokens — simpler ops, and 7 days matches
 *    LINE's typical id_token cadence anyway. After 7d, native re-runs LINE
 *    Login PKCE → fresh id_token → fresh JWT.
 */

const ALG = "HS256";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface MobileJwtPayload {
  sub: string; // User.id
  email: string;
  /// Increments when User is suspended/restored or password equivalent
  /// changes. Lets us invalidate old tokens server-side without storing them.
  v: number;
}

function getSecret(): Uint8Array {
  const raw = process.env.MOBILE_JWT_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "MOBILE_JWT_SECRET must be set to a string of at least 32 characters",
    );
  }
  return new TextEncoder().encode(raw);
}

export async function signMobileJwt(payload: MobileJwtPayload): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer("salepage")
    .setAudience("mobile")
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .setSubject(payload.sub)
    .sign(getSecret());
  return { token, expiresAt };
}

export async function verifyMobileJwt(
  token: string,
): Promise<MobileJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
      issuer: "salepage",
      audience: "mobile",
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.v !== "number"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      v: payload.v,
    };
  } catch {
    // Invalid signature, expired, or malformed → return null (let caller 401)
    return null;
  }
}
