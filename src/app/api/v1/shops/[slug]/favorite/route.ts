import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { resolveSession } from "@/lib/api-auth";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/v1/shops/:slug/favorite — heart the shop. Cheaper signal than
 * follow (no notification opt-ins). Idempotent.
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

  await db.shopFavorite.upsert({
    where: { userId_shopId: { userId: session.user.id, shopId: shop.id } },
    create: { userId: session.user.id, shopId: shop.id },
    update: {},
  });
  return ok({ favorited: true });
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

  await db.shopFavorite
    .delete({
      where: { userId_shopId: { userId: session.user.id, shopId: shop.id } },
    })
    .catch(() => undefined);
  return ok({ favorited: false });
}
