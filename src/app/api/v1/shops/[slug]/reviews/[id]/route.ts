import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const PatchBody = z.object({
  reply: z.string().max(2000),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Sign in required", 401);

  const { slug, id } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const parsed = await parseJson(request, PatchBody);
  if (!parsed.ok) return parsed.response;

  const review = await db.review.findUnique({
    where: { id },
    select: { shopId: true },
  });
  if (!review || review.shopId !== shop.id)
    return fail("not_found", "ไม่พบรีวิว", 404);

  const updated = await db.review.update({
    where: { id },
    data: { reply: parsed.data.reply, repliedAt: new Date() },
  });
  return ok({ review: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Sign in required", 401);

  const { slug, id } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const review = await db.review.findUnique({
    where: { id },
    select: { shopId: true },
  });
  if (!review || review.shopId !== shop.id)
    return fail("not_found", "ไม่พบรีวิว", 404);

  await db.review.delete({ where: { id } });

  // Re-roll average rating
  const agg = await db.review.aggregate({
    where: { shopId: shop.id },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await db.shop.update({
    where: { id: shop.id },
    data: {
      rating: agg._count._all > 0 ? Number((agg._avg.rating ?? 0).toFixed(2)) : 0,
    },
  });

  return ok({ deleted: true });
}
