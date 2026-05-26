/**
 * Provider-agnostic escrow service layer for Protected Pay.
 *
 * V1.5 ships a stub provider that records intent into the database (via the
 * caller — these functions only return refs) and lets us validate the full
 * lifecycle: hold → release | refund. Once we pick a real provider (2C2P
 * escrow, Beam, KBank Open API), we swap this single file and the
 * /api/v1/orders endpoint / cron / admin actions all keep working.
 *
 * The contract is intentionally minimal: each call returns the provider's
 * reference (or null for the stub) so we can store it on `EscrowHold.providerRef`
 * for audit + reconciliation.
 */
import { randomBytes } from "node:crypto";

export interface EscrowProvider {
  /**
   * Capture funds from the buyer's payment instrument and hold them in
   * escrow. For PromptPay/slip flow this is mostly a bookkeeping no-op —
   * the money has already arrived; we just mark it as "not yet released".
   *
   * Real providers (2C2P) would call out to authorize the payment with
   * the escrow flag set.
   */
  holdFunds(input: {
    holdId: string;
    orderId: string;
    amountSatang: number;
  }): Promise<{ providerRef: string }>;

  /**
   * Release held funds to the shop's bank account. For the stub this is
   * a no-op — real providers actually disburse.
   */
  releaseFunds(input: {
    holdId: string;
    providerRef: string | null;
  }): Promise<void>;

  /**
   * Refund held funds back to the buyer. Real providers would call out;
   * stub no-ops. The Order is separately flipped to REFUNDED by the caller.
   */
  refundFunds(input: {
    holdId: string;
    providerRef: string | null;
    reason: string;
  }): Promise<void>;
}

const STUB_PREFIX = "stub-escrow-";

const stubProvider: EscrowProvider = {
  async holdFunds({ holdId }) {
    return { providerRef: STUB_PREFIX + randomBytes(8).toString("hex") + "-" + holdId.slice(0, 6) };
  },
  async releaseFunds() {
    // no-op stub
  },
  async refundFunds() {
    // no-op stub
  },
};

let activeProvider: EscrowProvider = stubProvider;

export function getEscrowProvider(): EscrowProvider {
  return activeProvider;
}

/**
 * Test-only: swap the active provider. Production never calls this.
 */
export function __setEscrowProviderForTests(p: EscrowProvider): void {
  activeProvider = p;
}

// ─── Pricing helper ──────────────────────────────────────────────────────

/**
 * Platform escrow fee (in basis points = 100ths of a percent).
 *
 * V1.5: 150 bps = 1.5% — paid by the buyer on top of subtotal+shipping.
 * The shop receives the full pre-fee amount. We round UP to satang so we
 * never under-charge the buyer due to floor truncation; over-rounding is
 * at most 1 satang per order which is negligible.
 */
export const ESCROW_FEE_BPS = 150;

export function computeEscrowFeeSatang(amountSatang: number): number {
  if (amountSatang <= 0) return 0;
  return Math.ceil((amountSatang * ESCROW_FEE_BPS) / 10_000);
}

// ─── Release schedule ────────────────────────────────────────────────────

/**
 * Default auto-release window after the order transitions to DELIVERED.
 * V1.5: 72 hours — same as the dispute auto-resolve window so a buyer who
 * doesn't open a dispute within the dispute window forfeits the right to
 * one (escrow released). Lifted from this constant whenever we want to
 * change the policy.
 */
export const AUTO_RELEASE_HOURS_AFTER_DELIVERED = 72;

export function computeScheduledReleaseAt(deliveredAt: Date): Date {
  return new Date(deliveredAt.getTime() + AUTO_RELEASE_HOURS_AFTER_DELIVERED * 60 * 60 * 1000);
}
