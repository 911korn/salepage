import { resolveSession } from "@/lib/api-auth";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * GET  /api/v1/me/following — list shops the current user follows with their
 *      per-shop notification toggles (notifyNew / notifyLive / notifySale).
 *
 * PATCH /api/v1/me/following — update toggles for a single shop. Body:
 *      { shopId: string, notifyNew?: boolean, notifyLive?: boolean, notifySale?: boolean }
 *
 * Separate from `/shops/:slug/follow` (which only handles existence) because
 * the prefs UI lives in /me and needs all shops in one call.
 */
export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { user } = session;

  const follows = await db.shopFollow.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      shopId: true,
      notifyNew: true,
      notifyLive: true,
      notifySale: true,
      createdAt: true,
      shop: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoText: true,
          logoUrl: true,
          themeColor: true,
          category: true,
        },
      },
    },
  });

  return ok({
    follows: follows.map((f) => ({
      shopId: f.shopId,
      shop: f.shop,
      notifyNew: f.notifyNew,
      notifyLive: f.notifyLive,
      notifySale: f.notifySale,
      followedAt: f.createdAt,
    })),
  });
}

const PatchBody = z.object({
  shopId: z.string().min(1),
  notifyNew: z.boolean().optional(),
  notifyLive: z.boolean().optional(),
  notifySale: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { user } = session;

  const parsed = await parseJson(request, PatchBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Only the fields that were actually sent get patched — Prisma drops
  // `undefined` values so the user can flip one toggle without resetting the
  // others.
  const updated = await db.shopFollow
    .update({
      where: {
        userId_shopId: { userId: user.id, shopId: input.shopId },
      },
      data: {
        notifyNew: input.notifyNew,
        notifyLive: input.notifyLive,
        notifySale: input.notifySale,
      },
      select: {
        shopId: true,
        notifyNew: true,
        notifyLive: true,
        notifySale: true,
      },
    })
    .catch(() => null);

  if (!updated) return fail("not_following", "ยังไม่ได้ติดตามร้านนี้", 404);
  return ok(updated);
}
