import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyPlatformLineIdToken } from "@/lib/line";
import { signMobileJwt } from "@/lib/mobile-jwt";

/**
 * POST /api/v1/auth/line-mobile
 *
 * Body: { idToken: string }   ← from native LINE Login SDK
 *
 * Verifies the token with `https://api.line.me/oauth2/v2.1/verify`, finds-or-
 * creates a User keyed by the LINE-provided email (or a synthetic
 * `<userId>@line.salepage.in.th` if email scope was not granted), and returns
 * a SalePage JWT plus the canonical user id.
 *
 * The web project already has the same primitive used for guest LINE-in-LIFF
 * checkout (`verifyPlatformLineIdToken`), so we reuse that for parity.
 */
const Body = z.object({
  idToken: z.string().min(10).max(5000),
});

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  let profile: Awaited<ReturnType<typeof verifyPlatformLineIdToken>>;
  try {
    profile = await verifyPlatformLineIdToken(parsed.data.idToken);
  } catch (err) {
    return fail(
      "line_token_invalid",
      err instanceof Error ? err.message : "LINE id_token ไม่ถูกต้อง",
      401,
    );
  }

  // Email policy:
  //  - LINE returns `email` only if the LINE Login channel has the email scope
  //    granted AND the user opted in. If absent, we synthesize a deterministic
  //    address scoped to LINE so it never collides with real signups.
  //  - We never want this synthetic email shown to the user; UI prefers
  //    `name` (display name) wherever possible.
  const email =
    profile.email?.toLowerCase().trim() ||
    `${profile.sub}@line.salepage.in.th`;

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
    // Best-effort sync of LINE display fields whenever they change. We never
    // overwrite with null so users who edited their profile on the web keep
    // those overrides.
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
