import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { signMobileJwt, verifyMobileJwt } from "@/lib/mobile-jwt";

/**
 * POST /api/v1/auth/refresh
 *
 * Mobile-only flow: exchange a still-valid SalePage JWT for a fresh one.
 *
 * - Accepts a `Bearer` token whose signature is valid and not yet expired.
 * - Re-issues a token with a sliding 7-day TTL.
 * - Refuses if the user was suspended or removed in the interim.
 *
 * Doesn't accept expired tokens by design — we want force-relogin if the user
 * leaves the app dormant > 7 days. (LINE Login PKCE is fast; not worth the
 * complexity of refresh-token-rotation for a single-tenant mobile app.)
 */
export async function POST(request: Request) {
  const header =
    request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return fail("missing_bearer", "ไม่มี token", 401);
  }
  const token = header.slice(7).trim();
  const payload = await verifyMobileJwt(token);
  if (!payload) {
    return fail("invalid_token", "Token หมดอายุ กรุณา sign in ใหม่", 401);
  }

  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.suspended) {
    return fail("user_unavailable", "บัญชีนี้ใช้งานไม่ได้", 401);
  }

  const next = await signMobileJwt({
    sub: user.id,
    email: user.email,
    v: payload.v,
  });
  return ok({
    token: next.token,
    expiresAt: next.expiresAt.toISOString(),
    userId: user.id,
  });
}
