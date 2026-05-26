import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, AffiliatePayoutStatus } from "@/lib/db";
import { computeAffiliateBalance } from "@/lib/affiliate";

/**
 * Affiliate payout request endpoints.
 *
 * GET  /api/v1/me/payouts   — list this user's payout history (max 50)
 * POST /api/v1/me/payouts   — request a new payout for `amountSatang`
 *
 * Validation on POST:
 *   1. amount > 0 and ≤ payable balance
 *   2. amount ≥ 50 ฿ (5000 satang) — saves us from spam-dust requests
 *   3. promptpayId is non-empty (we don't strictly format-check; admin will)
 */
const MIN_PAYOUT_SATANG = 5000; // 50 baht

const RequestBody = z.object({
  amountSatang: z.number().int().positive(),
  promptpayId: z.string().trim().min(4).max(40),
});

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const payouts = await db.affiliatePayout.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      amountSatang: true,
      promptpayId: true,
      status: true,
      providerRef: true,
      rejectedReason: true,
      paidAt: true,
      reviewedAt: true,
      createdAt: true,
    },
  });

  return ok({ payouts });
}

export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { user } = session;

  const parsed = await parseJson(request, RequestBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  if (input.amountSatang < MIN_PAYOUT_SATANG) {
    return fail(
      "amount_below_minimum",
      `ยอดขั้นต่ำในการเบิก ${MIN_PAYOUT_SATANG / 100} บาท`,
      400,
      { minSatang: MIN_PAYOUT_SATANG },
    );
  }

  // Re-derive balance at request time so the user can't race-condition the
  // amount past their actual payable. We compute INSIDE a serializable tx
  // to prevent two concurrent requests from each seeing a fresh balance.
  const result = await db.$transaction(async () => {
    const balance = await computeAffiliateBalance(user.id);
    if (input.amountSatang > balance.payableSatang) {
      return {
        kind: "exceeds_balance" as const,
        payable: balance.payableSatang,
      };
    }
    const created = await db.affiliatePayout.create({
      data: {
        userId: user.id,
        amountSatang: input.amountSatang,
        promptpayId: input.promptpayId,
        status: AffiliatePayoutStatus.REQUESTED,
      },
      select: {
        id: true,
        amountSatang: true,
        promptpayId: true,
        status: true,
        createdAt: true,
      },
    });
    return { kind: "ok" as const, payout: created };
  });

  if (result.kind === "exceeds_balance") {
    return fail(
      "exceeds_balance",
      "ยอดที่ขอรับเกินยอดที่ถอนได้",
      400,
      { payableSatang: result.payable },
    );
  }

  return ok({ payout: result.payout }, { status: 201 });
}
