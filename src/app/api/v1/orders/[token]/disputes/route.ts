import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db, DisputeReason, DisputeStatus, OrderStatus } from "@/lib/db";
import { freezeEscrowForDispute } from "@/lib/escrow";

interface Ctx {
  params: Promise<{ token: string }>;
}

export const runtime = "nodejs";

/**
 * POST /api/v1/orders/:token/disputes — open a dispute on an order.
 *
 * Public (token-scoped). Buyers don't need to log in to open a dispute —
 * the publicToken acts as proof they have the order link. We do enforce:
 *
 *  1. Order must exist + not be CANCELLED already.
 *  2. Disputes can be opened from PAID onwards (no dispute on PENDING — the
 *     buyer can just cancel instead).
 *  3. Within 7 days of DELIVERED. Earlier statuses always allowed.
 *  4. Only one OPEN dispute per order. Repeat POSTs while OPEN return 409
 *     so a fat-finger double-submit doesn't create duplicates.
 *
 * GET also exposed so the tracking page can show "you opened a dispute on…"
 * inline next to the timeline.
 */
const Body = z.object({
  reason: z.enum([
    "NOT_RECEIVED",
    "WRONG_ITEM",
    "DAMAGED",
    "NOT_AS_DESCRIBED",
    "PAYMENT_ISSUE",
    "OTHER",
  ]),
  description: z.string().min(10).max(2000),
  // Vercel Blob URLs from prior `/api/v1/upload` calls. We accept up to 5
  // pieces of evidence per dispute; admin can request more in chat.
  evidence: z
    .array(
      z.object({
        kind: z.enum(["image", "text"]),
        value: z.string().min(1).max(2000),
      }),
    )
    .max(5)
    .default([]),
});

const DELIVERY_DISPUTE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const order = await db.order.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      status: true,
      customerName: true,
      customerPhone: true,
      customerLineUserId: true,
      // Detect the most recent DELIVERED transition for the 7-day window.
      // We use updatedAt as a proxy — orders only flip to DELIVERED via the
      // status PATCH route which bumps updatedAt.
      updatedAt: true,
    },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);
  if (
    order.status === OrderStatus.PENDING ||
    order.status === OrderStatus.CANCELLED
  ) {
    return fail(
      "not_disputable",
      "เปิดข้อพิพาทได้หลังจากชำระเงินแล้วเท่านั้น",
      409,
    );
  }
  if (
    order.status === OrderStatus.DELIVERED &&
    Date.now() - order.updatedAt.getTime() > DELIVERY_DISPUTE_WINDOW_MS
  ) {
    return fail(
      "dispute_window_expired",
      "เกิน 7 วันหลังจากได้รับของแล้ว — ไม่สามารถเปิดข้อพิพาทผ่านระบบได้",
      409,
    );
  }

  const existingOpen = await db.dispute.findFirst({
    where: {
      orderId: order.id,
      status: {
        in: [
          DisputeStatus.OPEN,
          DisputeStatus.AWAITING_SHOP_RESPONSE,
          DisputeStatus.AWAITING_BUYER_RESPONSE,
        ],
      },
    },
    select: { id: true, status: true },
  });
  if (existingOpen) {
    return fail(
      "dispute_already_open",
      "มีข้อพิพาทเปิดอยู่แล้วสำหรับคำสั่งซื้อนี้",
      409,
      { existingDisputeId: existingOpen.id, status: existingOpen.status },
    );
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const dispute = await db.dispute.create({
    data: {
      orderId: order.id,
      openedByName: order.customerName,
      openedByPhone: order.customerPhone ?? null,
      openedByLineId: order.customerLineUserId ?? null,
      reason: input.reason as DisputeReason,
      description: input.description.trim(),
      evidence: input.evidence,
      // Newly created → OPEN; admin flips to AWAITING_SHOP_RESPONSE after
      // skimming. Auto-resolver also reads OPEN to track 72h response SLA.
      status: DisputeStatus.OPEN,
    },
  });

  // V1.5 Protected Pay: freeze any HELD escrow so the auto-release cron
  // won't ship the money to the shop while we investigate.
  void freezeEscrowForDispute(order.id).catch((e) =>
    console.warn("[escrow] freezeEscrowForDispute failed:", e),
  );

  return ok({ dispute }, { status: 201 });
}

/**
 * GET /api/v1/orders/:token/disputes — list all disputes on this order.
 * Public, returns max 5 (more than that = abuse anyway).
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const order = await db.order.findUnique({
    where: { publicToken: token },
    select: { id: true },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);

  const disputes = await db.dispute.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      reason: true,
      description: true,
      evidence: true,
      status: true,
      resolution: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return ok({ disputes });
}
