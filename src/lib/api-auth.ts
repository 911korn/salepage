import { db } from "@/lib/db";
import { fail } from "@/lib/api";
import { verifyMobileJwt } from "@/lib/mobile-jwt";
import { auth } from "@/lib/auth";
import type { User } from "@/generated/prisma";

/**
 * Auth resolver for /api/v1/* route handlers.
 *
 * Two paths:
 *   1. `Authorization: Bearer <jwt>` — mobile app uses this exclusively.
 *   2. NextAuth session cookie — web uses this.
 *
 * Returns { ok: true, user } or { ok: false, response } so callers can
 * `if (!auth.ok) return auth.response;` at the top of any handler.
 */
export async function resolveSession(request: Request): Promise<
  | { ok: true; user: User; via: "bearer" | "cookie" }
  | { ok: false; response: Response }
> {
  // 1. Bearer token (mobile)
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    const payload = await verifyMobileJwt(token);
    if (!payload) {
      return {
        ok: false,
        response: fail("invalid_token", "Token หมดอายุ กรุณาเข้าสู่ระบบใหม่", 401),
      };
    }
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return {
        ok: false,
        response: fail("user_not_found", "ไม่พบบัญชีผู้ใช้", 401),
      };
    }
    if (user.suspended) {
      return {
        ok: false,
        response: fail("suspended", "บัญชีนี้ถูกระงับ", 403),
      };
    }
    return { ok: true, user, via: "bearer" };
  }

  // 2. NextAuth cookie session (web)
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: fail("unauthorized", "Sign in required", 401),
    };
  }
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return {
      ok: false,
      response: fail("unauthorized", "Sign in required", 401),
    };
  }
  if (user.suspended) {
    return {
      ok: false,
      response: fail("suspended", "บัญชีนี้ถูกระงับ", 403),
    };
  }
  return { ok: true, user, via: "cookie" };
}

/**
 * Soft variant of `resolveSession` — returns the authenticated `User` if a
 * valid Bearer token or cookie session is present, or `null` if anonymous.
 * Never 401s. Use on routes that allow anonymous AND authenticated callers
 * (e.g. `POST /api/v1/orders`) so the handler can opportunistically tag the
 * order with the buyer's `user.email`/`user.id` without forcing sign-in.
 *
 * 911korn 2026-05-27 IMG_5250: signed-in mobile buyers had orders created
 * without `customerEmail`, so the Orders tab (filtered by email) couldn't
 * find their pending PromptPay orders.
 */
export async function optionalSession(request: Request): Promise<User | null> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    const payload = await verifyMobileJwt(token);
    if (!payload) return null;
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.suspended) return null;
    return user;
  }
  try {
    const session = await auth();
    if (!session?.user?.id) return null;
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.suspended) return null;
    return user;
  } catch {
    return null;
  }
}
