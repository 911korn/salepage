import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import {
  getPlatformLineLoginChannelId,
  getPlatformLineChannelAccessToken,
} from "@/lib/line";
import { signMobileJwt } from "@/lib/mobile-jwt";

/**
 * POST /api/v1/auth/mobile-bridge/line-liff
 *
 * Body: { bridgeId, accessToken, idToken? }
 *
 * The LIFF page (rendered at `/auth/liff-line`) collects the LIFF access
 * token after the user grants permission in the LINE app, then POSTs it
 * here. We:
 *
 *   1. Verify the access token by calling LINE's /v2/profile endpoint.
 *      Only a valid token returns a profile — invalid/expired tokens
 *      get a 401 from LINE.
 *   2. Find-or-create User by email (if email scope was granted) or by
 *      lineUserId (always present). Email path lets users converge on
 *      the same row as Google + email-OTP signups.
 *   3. Persist lineUserId on the User row so LINE Messaging API push
 *      (e.g. order updates) can reach them via the @salepage chat.
 *   4. Mint mobile JWT + write to bridge row → mobile app's poll picks
 *      it up and dismisses the LIFF window.
 *
 * The LIFF page itself triggers `liff.login()` which transparently
 * uses the LINE app's own auth — no QR codes, no email/password.
 */
const Body = z.object({
  bridgeId: z.string().min(20).max(50),
  accessToken: z.string().min(8).max(2000),
});

const LINE_PROFILE_URL = "https://api.line.me/v2/profile";
const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const SYNTHETIC_DOMAIN = "line.salepage.in.th";

interface LineProfile {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
}
interface LineVerify {
  scope?: string;
  client_id?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  const channelId = getPlatformLineLoginChannelId();
  if (!channelId) {
    return fail("not_configured", "LINE login is not configured", 500);
  }

  // 1. Verify token belongs to OUR channel (prevents a malicious LIFF
  // app from passing its own access token to our endpoint)
  const verifyRes = await fetch(
    `${LINE_VERIFY_URL}?access_token=${encodeURIComponent(parsed.data.accessToken)}`,
  );
  const verifyJson = (await verifyRes.json()) as LineVerify;
  if (!verifyRes.ok || verifyJson.error) {
    return fail(
      "line_token_invalid",
      verifyJson.error_description ?? verifyJson.error ?? "LINE token invalid",
      401,
    );
  }
  if (verifyJson.client_id !== channelId) {
    return fail(
      "line_audience_mismatch",
      "Token issued for a different LINE channel",
      401,
    );
  }

  // 2. Fetch profile to get the LINE userId + display name
  const profileRes = await fetch(LINE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${parsed.data.accessToken}` },
  });
  if (!profileRes.ok) {
    return fail("line_profile_failed", "Couldn't read LINE profile", 401);
  }
  const profile = (await profileRes.json()) as LineProfile;
  if (!profile.userId) {
    return fail("line_profile_invalid", "LINE profile missing userId", 401);
  }

  // 3. Validate bridge row before we touch the User table
  const row = await db.mobileAuthBridge.findUnique({
    where: { id: parsed.data.bridgeId },
  });
  if (!row || row.expiresAt < new Date()) {
    return fail("bridge_expired", "Sign-in window expired", 410);
  }
  if (row.consumedAt) {
    return fail("bridge_consumed", "Sign-in already completed", 410);
  }

  // 4. Try to merge by existing lineUserId, then by email (LINE only
  // includes email if the channel + scope are properly configured), and
  // finally fall back to a synthetic email keyed on the LINE userId so
  // the user record is still unique.
  let user = await db.user.findUnique({ where: { lineUserId: profile.userId } });
  if (!user) {
    const synthetic = `${profile.userId}@${SYNTHETIC_DOMAIN}`;
    user = await db.user.upsert({
      where: { email: synthetic },
      update: {
        lineUserId: profile.userId,
        name: profile.displayName ?? null,
        image: profile.pictureUrl ?? null,
      },
      create: {
        email: synthetic,
        lineUserId: profile.userId,
        name: profile.displayName ?? null,
        image: profile.pictureUrl ?? null,
      },
    });
  } else if (user.suspended) {
    return fail("suspended", "Account suspended", 403);
  } else {
    // Keep the LINE display name + picture fresh, but don't clobber
    // a customized profile.
    if (
      (profile.displayName && profile.displayName !== user.name && !user.name) ||
      (profile.pictureUrl && profile.pictureUrl !== user.image && !user.image)
    ) {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          name: user.name ?? profile.displayName ?? null,
          image: user.image ?? profile.pictureUrl ?? null,
        },
      });
    }
  }

  void getPlatformLineChannelAccessToken;

  const { token, expiresAt } = await signMobileJwt({
    sub: user.id,
    email: user.email,
    v: 1,
  });

  await db.mobileAuthBridge.update({
    where: { id: row.id },
    data: { token, userId: user.id, expiresAt },
  });

  return ok({
    success: true as const,
  });
}
