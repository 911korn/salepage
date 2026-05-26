import { z } from "zod";
import bcrypt from "bcryptjs";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { signMobileJwt } from "@/lib/mobile-jwt";

/**
 * POST /api/v1/auth/email-otp/verify
 *
 * Body: { email, code }
 *
 * Finds the freshest unconsumed + unexpired OTP row for this email and
 * compares the bcrypt hash. Lock-out at 5 wrong attempts on the same row.
 * On success: find-or-create User keyed by lower-cased email, mint a
 * SalePage mobile JWT, mark the row consumed. Same User row as web
 * Auth.js Google + LINE bridges.
 */
const Body = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
});

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const email = parsed.data.email.toLowerCase().trim();

  const row = await db.emailLoginOtp.findFirst({
    where: {
      email,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    return fail(
      "otp_not_found",
      "ไม่พบรหัสที่ขอไว้ หรือรหัสหมดอายุ — กรุณาขอใหม่",
      404,
    );
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    // Mark consumed so further attempts on this row are blocked even if
    // the timer hasn't expired — forces the user to request a new code.
    await db.emailLoginOtp.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return fail(
      "too_many_attempts",
      "ใส่รหัสผิดเกิน 5 ครั้ง — กรุณาขอรหัสใหม่",
      429,
    );
  }

  const matched = await bcrypt.compare(parsed.data.code, row.codeHash);
  if (!matched) {
    await db.emailLoginOtp.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    return fail(
      "wrong_code",
      `รหัสไม่ถูกต้อง (เหลืออีก ${MAX_ATTEMPTS - row.attempts - 1} ครั้ง)`,
      401,
    );
  }

  // Find-or-create User by email — same pattern as line-mobile /
  // google-mobile so all three OAuth bridges + this email flow converge
  // on the same User row.
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({ data: { email } });
  } else if (user.suspended) {
    return fail("suspended", "บัญชีนี้ถูกระงับ", 403);
  }

  const { token, expiresAt } = await signMobileJwt({
    sub: user.id,
    email: user.email,
    v: 1,
  });

  // Mark consumed + link to user for audit
  await db.emailLoginOtp.update({
    where: { id: row.id },
    data: { consumedAt: new Date(), userId: user.id },
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
