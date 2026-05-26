import { resolveSession } from "@/lib/api-auth";
import { ok, fail, parseJson } from "@/lib/api";
import { db, KycStatus } from "@/lib/db";
import { recomputeTrustScore } from "@/lib/trust-score";
import { z } from "zod";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/v1/shops/:slug/kyc
 * GET  /api/v1/shops/:slug/kyc
 *
 * Shop-owner-only KYC submission. The owner uploads documents to
 * `/api/v1/upload` first to get back Vercel Blob URLs, then POSTs the URLs +
 * legal name + last-4 of their ID number here.
 *
 * After submission the shop flips to `kycStatus=PENDING`. An admin then uses
 * `/api/v1/admin/kyc` to approve/reject. Approval triggers
 * `recomputeTrustScore()` so the trust meter immediately reflects the +25.
 *
 * Idempotency: a submission while already PENDING/VERIFIED replaces the
 * existing payload — buyers shouldn't see this until admin re-reviews, so we
 * also reset reviewedAt/reviewedById.
 */
const SubmitBody = z.object({
  docType: z.enum(["NID", "PASSPORT", "COMPANY_REG"]),
  legalName: z.string().min(2).max(120),
  // Last 4 digits only — the full number stays on the document image.
  idLast4: z.string().regex(/^\d{4}$/, "ต้องเป็นเลข 4 หลัก"),
  docFrontUrl: z.string().url(),
  docBackUrl: z.string().url().optional(), // not needed for passport
  selfieUrl: z.string().url(),
});

export async function POST(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { user } = session;

  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true, kycStatus: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);
  if (shop.ownerId !== user.id) {
    return fail("forbidden", "เฉพาะเจ้าของร้านเท่านั้น", 403);
  }
  if (shop.kycStatus === KycStatus.VERIFIED) {
    return fail(
      "already_verified",
      "ร้านนี้ได้รับการยืนยันแล้ว — หากต้องการแก้ไข กรุณาติดต่อทีมงาน",
      409,
    );
  }

  const parsed = await parseJson(request, SubmitBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const updated = await db.shop.update({
    where: { id: shop.id },
    data: {
      kycStatus: KycStatus.PENDING,
      kycDocType: input.docType,
      kycLegalName: input.legalName.trim(),
      kycIdLast4: input.idLast4,
      kycDocFrontUrl: input.docFrontUrl,
      kycDocBackUrl: input.docBackUrl ?? null,
      kycSelfieUrl: input.selfieUrl,
      kycSubmittedAt: new Date(),
      kycRejectedReason: null,
      kycReviewedAt: null,
      kycReviewedById: null,
    },
    select: { id: true, kycStatus: true, kycSubmittedAt: true },
  });

  // Recompute now so the score reflects the PENDING state immediately.
  // (PENDING doesn't grant the +25 — that's reserved for VERIFIED — but the
  // trust recompute also picks up other changes that may have accumulated.)
  void recomputeTrustScore(shop.id).catch(() => undefined);

  return ok(updated, { status: 201 });
}

export async function GET(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { user } = session;

  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: {
      id: true,
      ownerId: true,
      kycStatus: true,
      kycVerifiedAt: true,
      kycRejectedReason: true,
      kycDocType: true,
      kycLegalName: true,
      kycIdLast4: true,
      kycSubmittedAt: true,
      kycReviewedAt: true,
      // Doc URLs are sensitive — only return them to the owner, not nested
      // inside admin payloads which use a different route.
      kycDocFrontUrl: true,
      kycDocBackUrl: true,
      kycSelfieUrl: true,
    },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);
  if (shop.ownerId !== user.id) {
    return fail("forbidden", "เฉพาะเจ้าของร้านเท่านั้น", 403);
  }

  return ok(shop);
}
