import { ok, fail } from "@/lib/api";
import { db, OrderStatus } from "@/lib/db";
import { notifyLineOrderUpdate } from "@/lib/line-order-notifications";

interface Ctx {
  params: Promise<{ token: string }>;
}

export const runtime = "nodejs";

/** POST /api/v1/orders/:token/cancel — public, token-scoped pending cancel. */
export async function POST(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: { shop: { select: { name: true, slug: true } } },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);
  if (order.status !== OrderStatus.PENDING) {
    return fail(
      "not_pending",
      "ออเดอร์นี้ไม่สามารถยกเลิกจากหน้าลูกค้าได้แล้ว",
      409,
      { status: order.status },
    );
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.CANCELLED },
    include: { shop: { select: { name: true, slug: true } } },
  });

  void notifyLineOrderUpdate(updated);

  return ok({ status: updated.status });
}
