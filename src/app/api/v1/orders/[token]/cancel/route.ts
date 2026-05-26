import { ok, fail } from "@/lib/api";
import { db, OrderStatus } from "@/lib/db";
import { notifyLineOrderUpdate } from "@/lib/line-order-notifications";

interface Ctx {
  params: Promise<{ token: string }>;
}

export const runtime = "nodejs";

/**
 * POST /api/v1/orders/:token/cancel — public, token-scoped pending cancel.
 *
 * Body (optional): `{ reason?: string }` — the tag picked by the buyer in
 * the mobile confirm sheet (e.g. "wrong-address" / "changed-mind"). Stored
 * for analytics + as context for the future 24h restore feature.
 * Inlined the body read so empty-body POSTs (the old mobile + web caller
 * shape) still go through without a 400.
 */
export async function POST(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  let reason: string | null = null;
  try {
    const raw = (await request.json().catch(() => null)) as
      | { reason?: unknown }
      | null;
    if (raw && typeof raw.reason === "string") {
      reason = raw.reason.trim().slice(0, 60) || null;
    }
  } catch {
    reason = null;
  }

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
    data: {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: "BUYER",
      cancelReason: reason,
    },
    include: { shop: { select: { name: true, slug: true } } },
  });

  void notifyLineOrderUpdate(updated);

  return ok({ status: updated.status });
}
