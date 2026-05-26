import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { logAdminAction, requireAdminApi } from "@/lib/admin";
import { db, AffiliatePayoutStatus } from "@/lib/db";
import { pushToUser } from "@/lib/push-notify";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/admin/payouts/:id
 *
 * Admin transitions an affiliate payout request through its lifecycle:
 *
 *   - approve         REQUESTED → APPROVED
 *   - mark_paid       APPROVED  → PAID (with providerRef)
 *   - reject          REQUESTED → REJECTED (with reason; releases the lock)
 *
 * Each terminal-ish action notifies the user. The balance helper
 * (`computeAffiliateBalance`) treats REJECTED + CANCELLED as released so
 * those transitions immediately free the locked amount for re-request.
 */
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("mark_paid"),
    providerRef: z.string().trim().min(2).max(120),
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(5).max(500),
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

  const payout = await db.affiliatePayout.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      userId: true,
      amountSatang: true,
      promptpayId: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!payout) return fail("not_found", "Payout not found", 404);

  // Validate the requested transition. We're strict here so the admin can't
  // accidentally approve an already-paid payout (which would no-op but
  // confuse the audit log).
  const allowed: Record<string, AffiliatePayoutStatus[]> = {
    approve: [AffiliatePayoutStatus.REQUESTED],
    mark_paid: [AffiliatePayoutStatus.APPROVED],
    reject: [AffiliatePayoutStatus.REQUESTED, AffiliatePayoutStatus.APPROVED],
  };
  if (!allowed[input.action].includes(payout.status)) {
    return fail(
      "invalid_transition",
      `Cannot ${input.action} a payout in status ${payout.status}`,
      409,
    );
  }

  const now = new Date();
  let nextStatus: AffiliatePayoutStatus;
  let pushPayload: { title: string; body: string } | null = null;
  const data: Record<string, unknown> = {
    reviewedByUserId: adminCtx.userId,
    reviewedAt: now,
  };

  switch (input.action) {
    case "approve":
      nextStatus = AffiliatePayoutStatus.APPROVED;
      pushPayload = {
        title: "✅ คำขอเบิกเงินอนุมัติแล้ว",
        body: `${(payout.amountSatang / 100).toLocaleString()} ฿ จะโอนเข้า PromptPay ${payout.promptpayId} ภายใน 1-2 วัน`,
      };
      break;
    case "mark_paid":
      nextStatus = AffiliatePayoutStatus.PAID;
      data.providerRef = input.providerRef;
      data.paidAt = now;
      pushPayload = {
        title: "💸 โอนเงินเรียบร้อยแล้ว",
        body: `${(payout.amountSatang / 100).toLocaleString()} ฿ ถูกโอนไปยัง ${payout.promptpayId} (ref: ${input.providerRef})`,
      };
      break;
    case "reject":
      nextStatus = AffiliatePayoutStatus.REJECTED;
      data.rejectedReason = input.reason;
      pushPayload = {
        title: "⚠️ คำขอเบิกเงินถูกปฏิเสธ",
        body: `เหตุผล: ${input.reason} — ยอดถูกปลดล็อกแล้ว ขอเบิกใหม่ได้`,
      };
      break;
  }

  data.status = nextStatus;

  await db.affiliatePayout.update({
    where: { id },
    data,
  });

  void pushToUser(payout.userId, {
    ...pushPayload,
    data: {
      kind: "affiliate.payout_updated",
      payoutId: payout.id,
      action: input.action,
    },
  }).catch(() => undefined);

  await logAdminAction(
    adminCtx.userId,
    `affiliate_payout.${input.action}`,
    { type: "affiliate_payout", id: payout.id },
    {
      userId: payout.userId,
      amountSatang: payout.amountSatang,
      previousStatus: payout.status,
      nextStatus,
      ...(input.action === "mark_paid"
        ? { providerRef: input.providerRef }
        : input.action === "reject"
          ? { reason: input.reason }
          : {}),
    },
  );

  return ok({ id: payout.id, status: nextStatus });
}
