import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { logAdminAction, requireAdminApi } from "@/lib/admin";
import { db, DisputeStatus, OrderStatus } from "@/lib/db";
import {
  pushToUser,
  resolveCustomerUserId,
  notifyEscrowReleasedToShop,
  notifyEscrowRefundedToBuyer,
} from "@/lib/push-notify";
import { recomputeTrustScore } from "@/lib/trust-score";
import { releaseEscrowHold, refundEscrowHold } from "@/lib/escrow";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/admin/disputes/:id
 *
 * Admin transitions a dispute. Three terminal resolutions:
 *
 *   - resolve_refund  → mark Order CANCELLED, set DisputeStatus.RESOLVED_REFUND.
 *                       Triggers a Trust Score recompute (loses penalty).
 *   - resolve_replace → keep Order, set DisputeStatus.RESOLVED_REPLACE.
 *                       Shop fulfills replacement off-platform.
 *   - resolve_no_action → buyer's claim rejected. DisputeStatus.RESOLVED_NO_ACTION.
 *
 * Also two state-only transitions:
 *
 *   - request_shop_response → AWAITING_SHOP_RESPONSE (resets the 72h SLA timer)
 *   - request_buyer_response → AWAITING_BUYER_RESPONSE
 *
 * `notes` is required for all resolve actions — admin must justify decisions
 * for the audit trail and for the buyer/shop notification body.
 */
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("resolve_refund"),
    notes: z.string().min(5).max(2000),
  }),
  z.object({
    action: z.literal("resolve_replace"),
    notes: z.string().min(5).max(2000),
  }),
  z.object({
    action: z.literal("resolve_no_action"),
    notes: z.string().min(5).max(2000),
  }),
  z.object({ action: z.literal("request_shop_response") }),
  z.object({ action: z.literal("request_buyer_response") }),
]);

export async function PATCH(request: Request, { params }: Ctx) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const adminCtx = guard.ctx;

  const { id } = await params;
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // We need the order to know the shop owner (to push) and the customer's
  // line user id (to push the buyer too). Joining once keeps the handler
  // single-query for state transitions.
  const dispute = await db.dispute.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      orderId: true,
      openedByLineId: true,
      order: {
        select: {
          id: true,
          status: true,
          publicToken: true,
          customerLineUserId: true,
          customerEmail: true,
          useEscrow: true,
          escrow: { select: { id: true, status: true, amountSatang: true } },
          shop: {
            select: {
              id: true,
              slug: true,
              name: true,
              ownerId: true,
            },
          },
        },
      },
    },
  });
  if (!dispute) return fail("not_found", "Dispute not found", 404);

  // Block double-close — once resolved, the only valid transition is via a
  // brand new dispute on the same order.
  const isTerminal = (s: DisputeStatus) =>
    s === DisputeStatus.RESOLVED_REFUND ||
    s === DisputeStatus.RESOLVED_REPLACE ||
    s === DisputeStatus.RESOLVED_NO_ACTION ||
    s === DisputeStatus.CLOSED;
  if (isTerminal(dispute.status)) {
    return fail(
      "already_resolved",
      `ข้อพิพาทนี้ปิดไปแล้ว (${dispute.status})`,
      409,
    );
  }

  const now = new Date();
  let nextStatus: DisputeStatus;
  let resolution: string | null = null;
  let pushBuyer: { title: string; body: string } | null = null;
  let pushShop: { title: string; body: string } | null = null;

  switch (input.action) {
    case "resolve_refund":
      nextStatus = DisputeStatus.RESOLVED_REFUND;
      resolution = input.notes;
      pushBuyer = {
        title: "✅ ข้อพิพาทได้รับการคืนเงิน",
        body: `${dispute.order.shop.name} จะคืนเงินตามเงื่อนไข: ${input.notes.slice(0, 80)}`,
      };
      pushShop = {
        title: "📋 ทีมงานตัดสินคืนเงิน",
        body: `ข้อพิพาทออเดอร์ #${dispute.order.publicToken.slice(0, 8)} ถูกตัดสินให้คืนเงิน — Trust Score ปรับลง`,
      };
      break;
    case "resolve_replace":
      nextStatus = DisputeStatus.RESOLVED_REPLACE;
      resolution = input.notes;
      pushBuyer = {
        title: "🔁 ข้อพิพาทได้รับการเปลี่ยนของ",
        body: `${dispute.order.shop.name} จะส่งของใหม่: ${input.notes.slice(0, 80)}`,
      };
      pushShop = {
        title: "📋 ตัดสินเปลี่ยนของ",
        body: `ข้อพิพาทออเดอร์ #${dispute.order.publicToken.slice(0, 8)} — กรุณาส่งของใหม่ตามคำสั่ง`,
      };
      break;
    case "resolve_no_action":
      nextStatus = DisputeStatus.RESOLVED_NO_ACTION;
      resolution = input.notes;
      pushBuyer = {
        title: "ℹ️ ข้อพิพาทถูกปิด",
        body: `ทีมงานพิจารณาแล้ว: ${input.notes.slice(0, 100)}`,
      };
      break;
    case "request_shop_response":
      nextStatus = DisputeStatus.AWAITING_SHOP_RESPONSE;
      pushShop = {
        title: "⚠️ มีข้อพิพาทรอการตอบกลับ",
        body: "ลูกค้าเปิดข้อพิพาทออเดอร์ของคุณ — กรุณาตอบกลับใน 72 ชั่วโมง ไม่งั้นจะถูกตัดสินคืนเงินอัตโนมัติ",
      };
      break;
    case "request_buyer_response":
      nextStatus = DisputeStatus.AWAITING_BUYER_RESPONSE;
      pushBuyer = {
        title: "💬 ทีมงานต้องการข้อมูลเพิ่ม",
        body: "ทีมงานขอข้อมูลเพิ่มเติมเกี่ยวกับข้อพิพาทที่คุณเปิด",
      };
      break;
  }

  // Update the dispute. For refund resolutions we ALSO flip the order back
  // to CANCELLED in the same transaction so stock & loyalty don't get
  // accidentally credited from a refunded order.
  await db.$transaction(async (tx) => {
    await tx.dispute.update({
      where: { id },
      data: {
        status: nextStatus,
        resolution,
        resolvedByUserId:
          input.action === "resolve_refund" ||
          input.action === "resolve_replace" ||
          input.action === "resolve_no_action"
            ? adminCtx.userId
            : null,
        resolvedAt:
          input.action === "resolve_refund" ||
          input.action === "resolve_replace" ||
          input.action === "resolve_no_action"
            ? now
            : null,
      },
    });

    if (input.action === "resolve_refund") {
      // Only flip non-cancelled orders. If the order was already cancelled
      // (e.g. shop-side cancel before admin saw the dispute), leave it.
      if (dispute.order.status !== OrderStatus.CANCELLED) {
        await tx.order.update({
          where: { id: dispute.order.id },
          data: { status: OrderStatus.CANCELLED },
        });
      }
    }
  });

  // Recompute trust score for refund/replace outcomes — both signal that
  // something went wrong on the shop side. NO_ACTION = buyer was wrong, no
  // adjustment.
  if (
    input.action === "resolve_refund" ||
    input.action === "resolve_replace"
  ) {
    void recomputeTrustScore(dispute.order.shop.id).catch(() => undefined);
  }

  // V1.5 Protected Pay: close out the escrow hold along with the dispute.
  //   refund    → money goes back to buyer + push them.
  //   no_action → release to shop + push them.
  //   replace   → release to shop (they're fulfilling off-platform) + push them.
  // We re-resolve the buyer's User id from LINE/email since the buyer push
  // (above) didn't keep it around — cheap one-off lookup.
  if (dispute.order.useEscrow && dispute.order.escrow) {
    const hold = dispute.order.escrow;
    if (input.action === "resolve_refund") {
      const refundRes = await refundEscrowHold({
        holdId: hold.id,
        reason: "dispute_refund",
      });
      if (refundRes.refunded) {
        void resolveCustomerUserId({
          customerLineUserId: dispute.order.customerLineUserId,
          customerEmail: dispute.order.customerEmail,
        }).then((buyerUserId) =>
          notifyEscrowRefundedToBuyer({
            customerUserId: buyerUserId,
            orderToken: dispute.order.publicToken,
            amountSatang: hold.amountSatang,
            reason: "dispute_refund",
          }),
        );
      }
    } else if (
      input.action === "resolve_no_action" ||
      input.action === "resolve_replace"
    ) {
      const releaseRes = await releaseEscrowHold({
        holdId: hold.id,
        reason: "dispute_no_action",
      });
      if (releaseRes.released) {
        void notifyEscrowReleasedToShop({
          shopOwnerUserId: dispute.order.shop.ownerId,
          orderToken: dispute.order.publicToken,
          amountSatang: hold.amountSatang,
          reason: "dispute_no_action",
        });
      }
    }
    // request_*_response actions: leave the hold DISPUTED — it stays frozen.
  }

  // Push notifications — fire-and-forget. Buyer push needs LINE→User
  // resolution since `pushToUser` takes a User.id, not a LINE provider sub.
  if (pushBuyer) {
    void resolveCustomerUserId({
      customerLineUserId: dispute.order.customerLineUserId,
      customerEmail: dispute.order.customerEmail,
    })
      .then((buyerUserId) => {
        if (!buyerUserId) return;
        return pushToUser(buyerUserId, {
          ...pushBuyer!,
          data: {
            kind: "dispute.updated",
            disputeId: dispute.id,
            orderToken: dispute.order.publicToken,
          },
        });
      })
      .catch(() => undefined);
  }
  if (pushShop) {
    void pushToUser(dispute.order.shop.ownerId, {
      ...pushShop,
      data: {
        kind: "dispute.updated",
        disputeId: dispute.id,
        orderToken: dispute.order.publicToken,
      },
    }).catch(() => undefined);
  }

  await logAdminAction(
    adminCtx.userId,
    `dispute.${input.action}`,
    { type: "dispute", id: dispute.id },
    {
      orderId: dispute.order.id,
      shopSlug: dispute.order.shop.slug,
      previousStatus: dispute.status,
      nextStatus,
      ...(resolution ? { resolution } : {}),
    },
  );

  return ok({ id: dispute.id, status: nextStatus });
}
