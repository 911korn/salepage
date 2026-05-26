import { z } from "zod";
import bcrypt from "bcryptjs";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { send } from "@/lib/email";

/**
 * POST /api/v1/auth/email-otp/send
 *
 * Body: { email }
 * Behaviour:
 *   1. Lower-case + trim the email.
 *   2. Throttle: if an unconsumed OTP was minted in the last 60s for this
 *      email, reject with 429 so we don't spam Resend.
 *   3. Generate a 6-digit code, hash it with bcrypt, store the hash.
 *   4. Email the plaintext code to the user.
 *
 * Plaintext code is never stored — only the hash. The verify endpoint
 * does the constant-time compare.
 */
const Body = z.object({
  email: z.string().email().max(254),
});

const TTL_MS = 10 * 60 * 1000; // 10 min
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 min

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const email = parsed.data.email.toLowerCase().trim();

  // Throttle — block burst sends to the same address. Counted across all
  // rows for this email, regardless of consumed state, since a wave of
  // failed-verify rows shouldn't unlock further sends either.
  const recent = await db.emailLoginOtp.findFirst({
    where: { email, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent) {
    const waitMs = RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime());
    return fail(
      "rate_limited",
      `กรุณารออีก ${Math.ceil(waitMs / 1000)} วินาทีก่อนขอรหัสใหม่`,
      429,
    );
  }

  // Generate a 6-digit code as a string with leading zeros preserved.
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 10);

  await db.emailLoginOtp.create({
    data: {
      email,
      codeHash,
      expiresAt: new Date(Date.now() + TTL_MS),
      requestIp:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      requestUa: request.headers.get("user-agent") ?? null,
    },
  });

  // Fire the email (non-blocking from caller's perspective via the helper).
  // We deliberately await here so we know whether to surface a send failure
  // back to the mobile client — otherwise the user types a code that was
  // never sent.
  const html = renderEmail(code);
  await send({
    to: email,
    subject: `รหัสเข้าสู่ระบบ SalePage: ${code}`,
    html,
  });

  return ok({
    sent: true as const,
    // Don't echo the code or the row id — mobile only needs to know that
    // an OTP was minted. The verify endpoint matches against the same
    // email + the freshest unconsumed row.
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
  });
}

function renderEmail(code: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#fafafa;font-family:'Helvetica Neue',Arial,sans-serif;color:#0a0a0a;">
  <div style="max-width:480px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border:1px solid #e4e4e7;border-radius:24px;padding:32px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:24px;">
        <div style="width:36px;height:36px;background:#e11d48;border-radius:10px;display:inline-block;"></div>
        <span style="font-weight:700;font-size:18px;letter-spacing:-0.01em;">Sale<span style="color:#e11d48;">Page</span></span>
      </div>
      <h1 style="font-size:18px;margin:0 0 12px 0;">รหัสเข้าสู่ระบบ</h1>
      <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
        ใช้รหัสนี้ในแอป SalePage เพื่อเข้าสู่ระบบ — รหัสจะหมดอายุภายใน 10 นาที
      </p>
      <div style="font-family:'SF Mono',Menlo,monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#0a0a0a;background:#fafafa;border-radius:12px;padding:16px;display:inline-block;">
        ${code}
      </div>
      <p style="color:#a1a1aa;font-size:12px;margin:24px 0 0 0;">
        ถ้าคุณไม่ได้ขอรหัสนี้ ละเว้นอีเมลฉบับนี้ได้เลย ไม่มีใครเข้าถึงบัญชีของคุณ
      </p>
    </div>
    <p style="text-align:center;color:#a1a1aa;font-size:11px;margin-top:16px;">
      © ${new Date().getFullYear()} SalePage · salepage.in.th
    </p>
  </div>
</body></html>`;
}
