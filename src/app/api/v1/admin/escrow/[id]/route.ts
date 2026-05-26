import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { logAdminAction, requireAdminApi } from "@/lib/admin";
import { db, EscrowStatus, OrderStatus } from "@/lib/db";
import { releaseEscrowHold, refundEscrowHold } from "@/lib/escrow";
import {
  notifyEscrowReleasedToShop,
  notifyEscrowRefundedToBuyer,
  resolveCustomerUserId,
} from "@/lib/push-notify";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/admin/escrow/:id
 *
 * Manual lifecycle controls for the platform operator. Used when something
 * weird happens (provider sync issue, shop closed, etc.) and the buyer or
 * shop needs intervention outside the normal dispute flow.
 *
 *   - `release` → flip HELD/DISPUTED to RELEASED + push shop.
 *   - `refund`  → flip HELD/DISPUTED to REFUNDED + push buyer. Also flips the
 *                 Order to CANCELLED if it wasn't already.
 *
 * Both actions require an `adminNote` for the audit trail.
 */
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("release"),
    adminNote: z.string().min(3).max(1000),
  }),
  z.object({
    action: z.literal("refund"),
    adminNote: z.string().min(3).max(1000),
  }),
]);

export async function PATCH(request: Request, { params }: Ctx) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const adminCtx = guard.ctx;

  const { id } = await params;
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const hold = await db.escrowHold.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      amountSatang: true,
      order: {
        select: {
          id: true,
          status: true,
          publicToken: true,
          customerLineUserId: true,
          customerEmail: true,
          shop: {
            select: { id: true, slug: true, name: true, ownerId: true },
          },
        },
      },
    },
  });
  if (!hold) return fail("not_found", "Escrow not found", 404);

  if (
    hold.status === EscrowStatus.RELEASED ||
    hold.status === EscrowStatus.REFUNDED
  ) {
    return fail(
      "already_closed",
      `Escrow already ${hold.status}`,
      409,
      { status: hold.status },
    );
  }

  if (input.action === "release") {
    const res = await releaseEscrowHold({
      holdId: hold.id,
      reason: "admin_manual",
    });
    if (res.released) {
      void notifyEscrowReleasedToShop({
        shopOwnerUserId: hold.order.shop.ownerId,
        orderToken: hold.order.publicToken,
        amountSatang: hold.amountSatang,
        reason: "admin_manual",
      }).catch(() => undefined);
    }
    await logAdminAction(
      adminCtx.userId,
      "escrow.release",
      { type: "escrow", id: hold.id },
      {
        orderId: hold.order.id,
        shopSlug: hold.order.shop.slug,
        amountSatang: hold.amountSatang,
        adminNote: input.adminNote,
      },
    );
    return ok({ id: hold.id, status: EscrowStatus.RELEASED });
  }

  // refund
  const res = await refundEscrowHold({
    holdId: hold.id,
    reason: "admin_refund",
  });
  if (res.refunded) {
    // Cancel the underlying order if not already terminal, so stock /
    // loyalty don't accrue.
    if (
      hold.order.status !== OrderStatus.CANCELLED &&
      hold.order.status !== OrderStatus.REFUNDED
    ) {
      await db.order
        .update({
          where: { id: hold.order.id },
          data: { status: OrderStatus.CANCELLED },
        })
        .catch(() => undefined);
    }
    void resolveCustomerUserId({
      customerLineUserId: hold.order.customerLineUserId,
      customerEmail: hold.order.customerEmail,
    }).then((buyerUserId) =>
      notifyEscrowRefundedToBuyer({
        customerUserId: buyerUserId,
        orderToken: hold.order.publicToken,
        amountSatang: hold.amountSatang,
        reason: "admin_refund",
      }),
    );
  }
  await logAdminAction(
    adminCtx.userId,
    "escrow.refund",
    { type: "escrow", id: hold.id },
    {
      orderId: hold.order.id,
      shopSlug: hold.order.shop.slug,
      amountSatang: hold.amountSatang,
      adminNote: input.adminNote,
    },
  );
  return ok({ id: hold.id, status: EscrowStatus.REFUNDED });
}
