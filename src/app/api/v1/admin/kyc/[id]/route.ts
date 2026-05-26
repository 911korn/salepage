import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { logAdminAction, requireAdminApi } from "@/lib/admin";
import { db, KycStatus } from "@/lib/db";
import { recomputeTrustScore } from "@/lib/trust-score";
import { pushToUser } from "@/lib/push-notify";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/admin/kyc/:id
 *
 * Admin approves or rejects a single shop's KYC submission. Body either
 * `{ action: "approve" }` or `{ action: "reject", reason: string }`.
 *
 * Approve  → kycStatus=VERIFIED, kycVerifiedAt=now, recompute trust → push
 * Reject   → kycStatus=REJECTED, kycRejectedReason=reason, recompute trust → push
 *
 * Either way we log to the audit trail so we can trace decisions.
 */
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().min(5).max(500),
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

  const shop = await db.shop.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      kycStatus: true,
    },
  });
  if (!shop) return fail("not_found", "Shop not found", 404);
  if (shop.kycStatus !== KycStatus.PENDING) {
    return fail(
      "not_pending",
      `KYC ของร้านนี้อยู่ในสถานะ ${shop.kycStatus} — ไม่ใช่ PENDING`,
      409,
    );
  }

  const now = new Date();
  const updated =
    input.action === "approve"
      ? await db.shop.update({
          where: { id },
          data: {
            kycStatus: KycStatus.VERIFIED,
            kycVerifiedAt: now,
            kycReviewedAt: now,
            kycReviewedById: adminCtx.userId,
            kycRejectedReason: null,
            // Sync legacy `verified` flag for any UI still reading it.
            verified: true,
          },
          select: {
            id: true,
            slug: true,
            kycStatus: true,
            kycVerifiedAt: true,
          },
        })
      : await db.shop.update({
          where: { id },
          data: {
            kycStatus: KycStatus.REJECTED,
            kycRejectedReason: input.reason,
            kycReviewedAt: now,
            kycReviewedById: adminCtx.userId,
            verified: false,
          },
          select: {
            id: true,
            slug: true,
            kycStatus: true,
            kycRejectedReason: true,
          },
        });

  // Recompute the trust score so the +25 (or removal) applies immediately.
  void recomputeTrustScore(shop.id).catch(() => undefined);

  // Push notify the shop owner. Fire-and-forget — failure shouldn't block
  // the admin's response.
  void pushToUser(shop.ownerId, {
    title:
      input.action === "approve"
        ? `ยินดีด้วย! ${shop.name} ผ่านการยืนยันแล้ว`
        : `${shop.name} ส่งเอกสารยืนยันไม่ผ่าน`,
    body:
      input.action === "approve"
        ? "ร้านของคุณได้แบดจ์ ✓ และ Trust Score +25 — ลูกค้าเชื่อใจมากขึ้นทันที"
        : `เหตุผล: ${input.reason} — ส่งเอกสารใหม่ได้ที่ /me/kyc`,
    data: { kind: "kyc.reviewed", shopSlug: shop.slug, action: input.action },
  }).catch(() => undefined);

  await logAdminAction(
    adminCtx.userId,
    `kyc.${input.action}`,
    { type: "shop", id: shop.id },
    {
      shopSlug: shop.slug,
      previousStatus: shop.kycStatus,
      ...(input.action === "reject" ? { reason: input.reason } : {}),
    },
  );

  return ok(updated);
}
