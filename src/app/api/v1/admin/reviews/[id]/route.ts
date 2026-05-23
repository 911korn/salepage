import { ok, fail } from "@/lib/api";
import { logAdminAction, requireAdminApi } from "@/lib/admin";
import { db } from "@/lib/db";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const { id } = await params;

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  const review = await db.review.findUnique({
    where: { id },
    select: {
      id: true,
      shopId: true,
      rating: true,
      customerName: true,
      comment: true,
    },
  });
  if (!review) return fail("not_found", "Review not found", 404);

  await db.review.delete({ where: { id } });

  // Recompute the shop's rating average — the moderation drop changes it.
  const agg = await db.review.aggregate({
    where: { shopId: review.shopId },
    _avg: { rating: true },
    _count: true,
  });
  await db.shop.update({
    where: { id: review.shopId },
    data: { rating: agg._count > 0 ? Number((agg._avg.rating ?? 0).toFixed(2)) : 0 },
  });

  await logAdminAction(
    ctx.userId,
    "review.delete",
    { type: "review", id },
    { shopId: review.shopId, snapshot: review },
  );

  return ok({ deleted: true });
}
