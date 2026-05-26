import { z } from "zod";
import { ok, parseJson } from "@/lib/api";
import { db } from "@/lib/db";

/**
 * POST /api/v1/auth/mobile-bridge/start
 *
 * Mints a fresh handoff slot the mobile app uses to receive a SalePage JWT
 * after the user completes Auth.js's normal Google sign-in on the web. The
 * returned `openUrl` points the system browser at /mobile-bridge/google
 * which kicks off the same OAuth flow the web uses.
 *
 * Why a separate "start" call instead of just opening the OAuth URL directly:
 *   - We want the row to exist before the browser opens — otherwise a slow
 *     network on the client could race the OAuth completion.
 *   - The bridgeId IS the polling token. Returning it here gives the app a
 *     stable handle without depending on the OAuth callback URL.
 */
const Body = z.object({
  provider: z.enum(["google", "line"]),
});

const EXPIRY_MS = 5 * 60 * 1000; // 5 min — covers OAuth login + 2FA + slow networks

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  const row = await db.mobileAuthBridge.create({
    data: {
      provider: parsed.data.provider,
      expiresAt: new Date(Date.now() + EXPIRY_MS),
    },
  });

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://salepage.in.th";
  const openUrl = `${origin}/api/v1/auth/mobile-bridge/${parsed.data.provider}?bridge=${row.id}`;

  return ok({
    bridgeId: row.id,
    openUrl,
    expiresAt: row.expiresAt.toISOString(),
  });
}
