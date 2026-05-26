import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { resolveSession } from "@/lib/api-auth";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/v1/shops/:slug/follow — add the current user as a follower.
 * DELETE — unfollow. Both idempotent.
 */
export async function POST(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { slug } = await ctx.params;

  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);

  await db.shopFollow.upsert({
    where: { userId_shopId: { userId: session.user.id, shopId: shop.id } },
    create: { userId: session.user.id, shopId: shop.id },
    update: {},
  });
  return ok({ following: true });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { slug } = await ctx.params;

  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);

  await db.shopFollow
    .delete({
      where: { userId_shopId: { userId: session.user.id, shopId: shop.id } },
    })
    .catch(() => undefined); // ignore not-found — already unfollowed
  return ok({ following: false });
}
