import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db, OrderStatus } from "@/lib/db";

interface Ctx {
  params: Promise<{ token: string }>;
}

/**
 * PATCH /api/v1/orders/:token/status — shop owner only.
 *
 * Allowed transitions (we enforce them server-side to avoid the UI letting
 * the owner accidentally walk backwards from DELIVERED to PENDING, etc.):
 *   PENDING    → PAID | CANCELLED
 *   PAID       → SHIPPING | CANCELLED
 *   SHIPPING   → DELIVERED | CANCELLED
 *   DELIVERED  → (terminal)
 *   CANCELLED  → (terminal)
 *   REFUNDED   → (terminal)
 *
 * Token is the order's `publicToken` (same identifier the customer uses) so
 * the dashboard can deep-link without exposing internal Order.id.
 */
const Body = z.object({
  status: z
    .enum(["PAID", "SHIPPING", "DELIVERED", "CANCELLED", "REFUNDED"])
    .optional(),
  trackingNumber: z.string().max(60).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const ALLOWED_NEXT: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPING, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPING]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Sign in required", 401);

  const { token } = await ctx.params;
  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: { shop: { select: { id: true, ownerId: true } } },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);
  if (order.shop.ownerId !== session.user.id) {
    return fail("forbidden", "ไม่มีสิทธิ์", 403);
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { status, trackingNumber, notes } = parsed.data;

  const data: Record<string, unknown> = {};
  if (status !== undefined) {
    const allowed = ALLOWED_NEXT[order.status];
    if (!allowed.includes(status as OrderStatus)) {
      return fail(
        "invalid_transition",
        `สถานะ ${order.status} เปลี่ยนเป็น ${status} ไม่ได้`,
        409,
      );
    }
    data.status = status;
  }
  if (trackingNumber !== undefined) data.trackingNumber = trackingNumber;
  if (notes !== undefined) data.notes = notes;

  const updated = await db.order.update({
    where: { id: order.id },
    data,
  });

  return ok({ order: updated });
}
