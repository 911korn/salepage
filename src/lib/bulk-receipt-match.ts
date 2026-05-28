import "server-only";
import { namesLooselyMatch } from "@/lib/ocr-shipping-receipt";
import { buildOrderRef } from "@/lib/orders";
import type { BulkReceiptEntry } from "@/lib/ocr-bulk-receipt";

/**
 * Match scanned shipping-receipt entries against the shop's unshipped
 * orders. Each PAID order with no `trackingNumber` yet is a candidate.
 *
 * Scoring (out of 100):
 *   - exact-or-loose name match  → +50
 *   - postcode match (5 digits)  → +30
 *   - phone tail (last 4 digits) → +20
 *
 * Confidence buckets:
 *   - score >= 80  → "auto"      — confident enough to flip without seller review
 *   - score >= 40  → "review"    — likely match, seller picks from top 3
 *   - score <  40  → "unmatched" — no good candidate; seller manually assigns
 *
 * "name_unreadable" receipts (Thailand Post eCo-Post that don't print
 * recipient name) score at most postcode+phone (50) — they're forced
 * into review even when they're the only viable candidate, because
 * we never want to silently bind a tracking number without a positive
 * signal that it matches the order. 911korn 2026-05-28.
 */

export interface MatchCandidateOrder {
  id: string;
  publicToken: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  totalSatang: number;
  createdAt: Date;
  labelGeneratedAt: Date | null;
}

export interface MatchedReceipt {
  trackingNumber: string;
  receiverName: string | null;
  postcode: string | null;
  phoneTail: string | null;
  courier: BulkReceiptEntry["courier"];
  confidence: BulkReceiptEntry["confidence"];
  /** 0-indexed position of the source photo within the batch upload. */
  photoIndex: number;
  /** 1-indexed position of this receipt within its source photo. */
  indexInPhoto: number;
  /** Best-effort normalised bbox for cropping; null = show whole photo. */
  bbox: [number, number, number, number] | null;
  /** "auto" matches can be applied without seller confirm. */
  status: "auto" | "review" | "unmatched";
  /** True when the receipt was photographed next to a SalePage label
   *  and the orderRef / publicToken on the label resolved to a valid
   *  candidate order. UI can show a "💎 Paired by label" badge. */
  labelPaired: boolean;
  /** Ranked candidate orders. For "auto" the [0] is the chosen one.
   *  For "review" up to 3 are returned so the seller can disambiguate.
   *  For "unmatched" this is empty and the seller picks from a full
   *  paid-orders dropdown in the UI. */
  candidates: Array<{ orderId: string; publicToken: string; score: number }>;
}

const SCORE_NAME = 50;
const SCORE_POSTCODE = 30;
const SCORE_PHONE = 20;
const THRESHOLD_AUTO = 80;
const THRESHOLD_REVIEW = 40;

export function matchBulkReceipts({
  receipts,
  candidates,
}: {
  receipts: Array<BulkReceiptEntry & { photoIndex: number }>;
  candidates: MatchCandidateOrder[];
}): MatchedReceipt[] {
  // Track which order IDs have already been claimed by a higher-confidence
  // match so we never auto-bind the same order to two trackings.
  const claimed = new Set<string>();

  // Pass 0 (label-pair fast-path) — if the seller photographed the
  // receipt next to our printed SalePage label, Claude returned the
  // label's publicToken or orderRef. That's a deliberate human signal:
  // pin the binding 100% and skip the scoring step entirely. We pre-
  // compute the orderRef for each candidate so the OCR'd ref string
  // can be matched without a DB round-trip.
  const tokenIndex = new Map(candidates.map((c) => [c.publicToken, c]));
  const refIndex = new Map(
    candidates.map((c) => [buildOrderRef(c.createdAt, c.id), c]),
  );
  const labelPaired = new Map<string, MatchCandidateOrder>();
  for (const r of receipts) {
    let paired: MatchCandidateOrder | undefined;
    if (r.salepagePublicToken) {
      paired = tokenIndex.get(r.salepagePublicToken);
    }
    if (!paired && r.salepageOrderRef) {
      paired = refIndex.get(r.salepageOrderRef);
    }
    if (paired && !claimed.has(paired.id)) {
      labelPaired.set(r.trackingNumber, paired);
      claimed.add(paired.id);
    }
  }

  // Pass 1: score every receipt against every still-available candidate,
  // sorted by best-match-first so higher-confidence wins the claim.
  const scored = receipts.map((r) => ({
    receipt: r,
    ranking: scoreAgainstCandidates(r, candidates),
  }));
  scored.sort((a, b) => (b.ranking[0]?.score ?? 0) - (a.ranking[0]?.score ?? 0));

  const out: MatchedReceipt[] = [];
  for (const { receipt, ranking } of scored) {
    const pairedOrder = labelPaired.get(receipt.trackingNumber);

    // Drop already-claimed orders from the ranking.
    const available = ranking.filter(
      (c) => !claimed.has(c.orderId) || c.orderId === pairedOrder?.id,
    );

    let status: MatchedReceipt["status"];
    let candidates: MatchedReceipt["candidates"];

    if (pairedOrder) {
      // Label-pair fast path: force auto, score 100, ignore name guard.
      status = "auto";
      candidates = [
        {
          orderId: pairedOrder.id,
          publicToken: pairedOrder.publicToken,
          score: 100,
        },
      ];
    } else {
      const top = available[0];
      // Force a manual review when the OCR didn't extract a recipient
      // name — never silently bind tracking without a positive signal.
      const looksUnreadable = !receipt.receiverName;

      if (top && top.score >= THRESHOLD_AUTO && !looksUnreadable) {
        status = "auto";
        claimed.add(top.orderId);
      } else if (top && top.score >= THRESHOLD_REVIEW) {
        status = "review";
      } else {
        status = "unmatched";
      }
      candidates = available.slice(0, 3);
    }

    out.push({
      trackingNumber: receipt.trackingNumber,
      receiverName: receipt.receiverName,
      postcode: receipt.postcode,
      phoneTail: receipt.phoneTail,
      courier: receipt.courier,
      confidence: receipt.confidence,
      photoIndex: receipt.photoIndex,
      indexInPhoto: receipt.indexInPhoto,
      bbox: receipt.bbox,
      status,
      labelPaired: Boolean(pairedOrder),
      candidates,
    });
  }

  // Restore reading order (photo asc, indexInPhoto asc) so the UI shows
  // receipts in the same order the seller sees them on paper.
  out.sort((a, b) => {
    if (a.photoIndex !== b.photoIndex) return a.photoIndex - b.photoIndex;
    return a.indexInPhoto - b.indexInPhoto;
  });
  return out;
}

function scoreAgainstCandidates(
  receipt: BulkReceiptEntry,
  candidates: MatchCandidateOrder[],
): Array<{ orderId: string; publicToken: string; score: number }> {
  const ranked = candidates
    .map((c) => ({ ...c, score: scoreOne(receipt, c) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((c) => ({ orderId: c.id, publicToken: c.publicToken, score: c.score }));
  return ranked;
}

function scoreOne(receipt: BulkReceiptEntry, c: MatchCandidateOrder): number {
  let s = 0;

  if (receipt.receiverName && namesLooselyMatch(receipt.receiverName, c.customerName)) {
    s += SCORE_NAME;
  }

  if (receipt.postcode && c.customerAddress) {
    // Thai addresses tend to end with `... <province> <postcode>` — look
    // for the 5-digit postcode anywhere in the stored address string.
    const m = c.customerAddress.match(/\d{5}/g);
    if (m && m.includes(receipt.postcode)) s += SCORE_POSTCODE;
  }

  if (receipt.phoneTail && c.customerPhone) {
    const candidateTail = c.customerPhone.replace(/\D/g, "").slice(-4);
    if (candidateTail.length === 4 && candidateTail === receipt.phoneTail) {
      s += SCORE_PHONE;
    }
  }

  return s;
}

/** Re-exported so the API layer can communicate consistent thresholds
 *  to the dashboard UI (badges, hover tooltips, etc.). */
export const MATCH_THRESHOLDS = {
  auto: THRESHOLD_AUTO,
  review: THRESHOLD_REVIEW,
} as const;
