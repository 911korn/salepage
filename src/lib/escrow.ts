/**
 * Application-level escrow service. Wraps the swappable provider with our
 * own bookkeeping rows and centralized side-effects so callers (slip-verify,
 * status PATCH, dispute resolver, admin queue, cron) all share the same
 * invariants:
 *
 *   - There is at most one EscrowHold per Order (orderId unique).
 *   - Status transitions are linear: HELD → (RELEASED | REFUNDED). DISPUTED
 *     is a temporary detour from HELD; it can resolve back to either of the
 *     two terminal states.
 *   - Every transition writes a `closeReason` tag so the audit log explains
 *     which actor triggered it.
 *
 * Important: callers are responsible for the order's own `status` field.
 * This module only touches the EscrowHold row.
 */
import { db, EscrowStatus } from "@/lib/db";
import { getEscrowProvider, computeScheduledReleaseAt } from "@/lib/escrow-provider";

export interface CreateHoldInput {
  orderId: string;
  amountSatang: number;
  feeSatang: number;
}

/**
 * Idempotently create an EscrowHold for an Order that just transitioned to
 * PAID. Returns the existing row if one already exists (e.g. caller retried).
 *
 * `scheduledReleaseAt` is left null here — it gets populated on the
 * DELIVERED transition via `markEscrowDelivered()` so the cron knows when
 * the auto-release window opens.
 */
export async function createEscrowHoldOnPaid(
  input: CreateHoldInput,
): Promise<{ id: string; status: EscrowStatus; providerRef: string | null }> {
  const existing = await db.escrowHold.findUnique({
    where: { orderId: input.orderId },
    select: { id: true, status: true, providerRef: true },
  });
  if (existing) return existing;

  // Create first so we have an ID to hand to the provider.
  const created = await db.escrowHold.create({
    data: {
      orderId: input.orderId,
      amountSatang: input.amountSatang,
      feeSatang: input.feeSatang,
      status: EscrowStatus.HELD,
    },
    select: { id: true, status: true },
  });

  // Stub provider returns a synthetic ref; real providers would call out
  // here. We don't fail the order if the provider errors — the hold row
  // exists and we can reconcile later.
  let providerRef: string | null = null;
  try {
    const res = await getEscrowProvider().holdFunds({
      holdId: created.id,
      orderId: input.orderId,
      amountSatang: input.amountSatang,
    });
    providerRef = res.providerRef;
    await db.escrowHold.update({
      where: { id: created.id },
      data: { providerRef },
    });
  } catch (e) {
    console.warn("[escrow] holdFunds provider call failed:", e);
  }

  return { id: created.id, status: created.status, providerRef };
}

/**
 * Called when an Order transitions to DELIVERED. Sets the
 * `scheduledReleaseAt` clock on the hold so the auto-release cron starts
 * counting. No-op if the order doesn't have a HELD escrow.
 */
export async function markEscrowDelivered(
  orderId: string,
  deliveredAt: Date,
): Promise<void> {
  const hold = await db.escrowHold.findUnique({
    where: { orderId },
    select: { id: true, status: true, scheduledReleaseAt: true },
  });
  if (!hold || hold.status !== EscrowStatus.HELD) return;
  // Don't override an already-set clock — DELIVERED can be set multiple
  // times if the seller toggles status, but the first one wins.
  if (hold.scheduledReleaseAt) return;

  await db.escrowHold.update({
    where: { id: hold.id },
    data: { scheduledReleaseAt: computeScheduledReleaseAt(deliveredAt) },
  });
}

export type ReleaseReason =
  | "buyer_confirmed"
  | "auto_release_72h"
  | "admin_manual"
  | "dispute_no_action";

/**
 * Release a HELD or DISPUTED escrow to the shop. Idempotent — calling on
 * an already-RELEASED hold is a no-op (returns the existing row). Returns
 * false if the hold is REFUNDED (cannot release after refund).
 */
export async function releaseEscrowHold(input: {
  holdId: string;
  reason: ReleaseReason;
}): Promise<{ released: boolean; alreadyReleased: boolean }> {
  const hold = await db.escrowHold.findUnique({
    where: { id: input.holdId },
    select: { id: true, status: true, providerRef: true },
  });
  if (!hold) return { released: false, alreadyReleased: false };
  if (hold.status === EscrowStatus.RELEASED) {
    return { released: false, alreadyReleased: true };
  }
  if (hold.status === EscrowStatus.REFUNDED) {
    return { released: false, alreadyReleased: false };
  }

  await db.escrowHold.update({
    where: { id: input.holdId },
    data: {
      status: EscrowStatus.RELEASED,
      releasedAt: new Date(),
      closeReason: input.reason,
    },
  });
  try {
    await getEscrowProvider().releaseFunds({
      holdId: input.holdId,
      providerRef: hold.providerRef,
    });
  } catch (e) {
    console.warn("[escrow] releaseFunds provider call failed:", e);
  }
  return { released: true, alreadyReleased: false };
}

export type RefundReason = "admin_refund" | "dispute_refund";

/**
 * Refund a HELD or DISPUTED escrow back to the buyer. Idempotent.
 */
export async function refundEscrowHold(input: {
  holdId: string;
  reason: RefundReason;
}): Promise<{ refunded: boolean; alreadyRefunded: boolean }> {
  const hold = await db.escrowHold.findUnique({
    where: { id: input.holdId },
    select: { id: true, status: true, providerRef: true },
  });
  if (!hold) return { refunded: false, alreadyRefunded: false };
  if (hold.status === EscrowStatus.REFUNDED) {
    return { refunded: false, alreadyRefunded: true };
  }
  if (hold.status === EscrowStatus.RELEASED) {
    // Cannot refund after release; caller should issue a manual reversal.
    return { refunded: false, alreadyRefunded: false };
  }

  await db.escrowHold.update({
    where: { id: input.holdId },
    data: {
      status: EscrowStatus.REFUNDED,
      refundedAt: new Date(),
      closeReason: input.reason,
    },
  });
  try {
    await getEscrowProvider().refundFunds({
      holdId: input.holdId,
      providerRef: hold.providerRef,
      reason: input.reason,
    });
  } catch (e) {
    console.warn("[escrow] refundFunds provider call failed:", e);
  }
  return { refunded: true, alreadyRefunded: false };
}

/**
 * Flip a HELD escrow into DISPUTED state so the auto-release cron skips it.
 * Used by the dispute creator endpoint. No-op if not currently HELD.
 */
export async function freezeEscrowForDispute(orderId: string): Promise<void> {
  await db.escrowHold.updateMany({
    where: { orderId, status: EscrowStatus.HELD },
    data: { status: EscrowStatus.DISPUTED },
  });
}

/**
 * Thaw a DISPUTED escrow back to HELD (e.g. when admin asks for more info).
 * Used when a dispute transitions back to "needs response".
 */
export async function thawEscrowFromDispute(orderId: string): Promise<void> {
  await db.escrowHold.updateMany({
    where: { orderId, status: EscrowStatus.DISPUTED },
    data: { status: EscrowStatus.HELD },
  });
}
