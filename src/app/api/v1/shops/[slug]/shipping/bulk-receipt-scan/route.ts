import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, OrderStatus } from "@/lib/db";
import { hasBusinessPlan } from "@/lib/plan";
import { scanBulkShippingReceipt } from "@/lib/ocr-bulk-receipt";
import {
  matchBulkReceipts,
  MATCH_THRESHOLDS,
  type MatchCandidateOrder,
} from "@/lib/bulk-receipt-match";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/v1/shops/[slug]/shipping/bulk-receipt-scan
 *
 * Seller photographs a batch of courier drop-off receipts. We OCR each
 * photo (Claude Sonnet vision), pull every {trackingNumber, receiverName,
 * postcode, phone} we can read, then score each against the shop's
 * PAID-with-no-tracking orders. Result splits into three buckets:
 *
 *   - auto       — score >= 80, will be applied without a second confirm
 *   - review     — score >= 40, top-3 candidates shown to seller
 *   - unmatched  — score <  40, full paid-orders dropdown for manual pick
 *
 * Returns the match plan only. The seller reviews + confirms, then calls
 * /bulk-receipt-apply to actually flip orders to SHIPPING.
 *
 * Gated to Business+ — same plan tier as single-order Auto Tracking.
 * 911korn 2026-05-28 "เคสที่ Seller ส่งเยอะๆ ... 1 วัน ส่ง 100 Order
 * มันควรที่จะฉลาดพอในการอ่านทั้งหมดแล้วนำไป Update ให้กับทุก Order".
 */

const PhotoSchema = z.object({
  dataBase64: z.string().min(100).max(10_000_000),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const Body = z.object({
  photos: z.array(PhotoSchema).min(1).max(20),
});

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, ctx: Ctx) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail(
      "ocr_not_configured",
      "AI scan ยังไม่พร้อมใช้งาน — ระบบยังไม่ได้ตั้งค่า",
      503,
    );
  }

  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true, name: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้าน", 404);
  if (shop.ownerId !== session.user.id) {
    return fail("forbidden", "ไม่ใช่เจ้าของร้านนี้", 403);
  }
  // V2.1 Auto Tracking gate — Business+ only.
  if (!(await hasBusinessPlan(session.user.id))) {
    return fail(
      "upgrade_required",
      "AI Bulk Tracking ใช้ได้กับแผน Business ขึ้นไป",
      402,
    );
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const photos = parsed.data.photos;

  // OCR every photo in parallel. Claude vision is rate-limited per
  // organisation but 20 concurrent requests for one batch is fine.
  const ocrResults = await Promise.all(
    photos.map((p) =>
      scanBulkShippingReceipt(
        p.dataBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, ""),
        p.contentType,
      ),
    ),
  );

  // Flatten into one big list, tagging each with the source photo index.
  const allReceipts = ocrResults.flatMap((r, photoIndex) =>
    r.receipts.map((entry) => ({ ...entry, photoIndex })),
  );

  // Per-photo notes — useful when a whole photo was unreadable or wrong.
  const photoNotes = ocrResults.map((r, i) => ({
    photoIndex: i,
    note: r.note,
    receiptsFound: r.receipts.length,
  }));

  if (allReceipts.length === 0) {
    return ok({
      photos: photoNotes,
      matches: [],
      candidatePool: [],
      thresholds: MATCH_THRESHOLDS,
      message:
        "ไม่เจอใบเสร็จในรูปที่อัปโหลด — ลองถ่ายให้เห็นเลข tracking ชัดเจน หรือลดจำนวนใบเสร็จต่อรูป",
    });
  }

  // Dedup tracking numbers across photos — same receipt photographed
  // twice shouldn't generate two match attempts.
  const seenTrackings = new Set<string>();
  const uniqueReceipts = allReceipts.filter((r) => {
    if (seenTrackings.has(r.trackingNumber)) return false;
    seenTrackings.add(r.trackingNumber);
    return true;
  });

  // Reject any tracking number already claimed by another order in this
  // shop — happens when the seller re-scans receipts from yesterday.
  const alreadyAssigned = await db.order.findMany({
    where: {
      shopId: shop.id,
      trackingNumber: { in: Array.from(seenTrackings) },
    },
    select: { trackingNumber: true, publicToken: true, status: true },
  });
  const alreadyMap = new Map(
    alreadyAssigned.map((o) => [o.trackingNumber!, o.publicToken]),
  );

  const stillUnmatched = uniqueReceipts.filter(
    (r) => !alreadyMap.has(r.trackingNumber),
  );

  // Pool of orders the seller can match against — every PAID order in
  // this shop that doesn't have a tracking number yet, with the metadata
  // we need for both scoring and the unmatched-dropdown UI.
  const candidates: MatchCandidateOrder[] = await db.order.findMany({
    where: {
      shopId: shop.id,
      status: OrderStatus.PAID,
      trackingNumber: null,
    },
    select: {
      id: true,
      publicToken: true,
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      totalSatang: true,
      createdAt: true,
      labelGeneratedAt: true,
    },
    orderBy: [{ labelGeneratedAt: "desc" }, { createdAt: "desc" }],
    take: 500, // upper bound so a malicious shop can't OOM the matcher
  });

  const matches = matchBulkReceipts({
    receipts: stillUnmatched,
    candidates,
  });

  // Tack the "already assigned elsewhere" tracking numbers onto the
  // response so the UI can show them as "ซ้ำ" badges instead of silently
  // dropping them.
  const duplicates = uniqueReceipts
    .filter((r) => alreadyMap.has(r.trackingNumber))
    .map((r) => ({
      trackingNumber: r.trackingNumber,
      photoIndex: r.photoIndex,
      indexInPhoto: r.indexInPhoto,
      assignedToOrderToken: alreadyMap.get(r.trackingNumber)!,
    }));

  return ok({
    photos: photoNotes,
    matches,
    duplicates,
    candidatePool: candidates.map((c) => ({
      orderId: c.id,
      publicToken: c.publicToken,
      customerName: c.customerName,
      customerPhone: c.customerPhone,
      customerAddress: c.customerAddress,
      totalSatang: c.totalSatang,
      createdAt: c.createdAt.toISOString(),
      labelPrintedAt: c.labelGeneratedAt?.toISOString() ?? null,
    })),
    thresholds: MATCH_THRESHOLDS,
  });
}
