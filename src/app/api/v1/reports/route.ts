import { z } from "zod";
import { resolveSession } from "@/lib/api-auth";
import { ok, fail, parseJson } from "@/lib/api";
import { db, ContentReportKind, ContentReportReason } from "@/lib/db";

/**
 * POST /api/v1/reports
 *
 * Apple Guideline 1.2 — UGC moderation. Any signed-in buyer/seller can
 * report any user-generated content. We commit to acting on every
 * report within 24 hours (operators page on /admin/reports).
 *
 * Shape: { kind: SHOP|PRODUCT|REVIEW|STORY|LIVE_COMMENT,
 *          targetId: string,  // shopSlug / productSlug / id depending on kind
 *          reason: SPAM|INAPPROPRIATE|COUNTERFEIT|HARASSMENT|ILLEGAL|MISLEADING|OTHER,
 *          note?: string }
 *
 * One report per (reporter, target) per 24h to prevent spam.
 */
const Body = z.object({
  kind: z.nativeEnum(ContentReportKind),
  // We accept either a slug (for SHOP/PRODUCT/STORY/LIVE_COMMENT) or a cuid (REVIEW).
  // The route resolves to the DB id below.
  targetId: z.string().min(1).max(200),
  reason: z.nativeEnum(ContentReportReason),
  note: z.string().max(1000).optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { kind, targetId, reason, note } = parsed.data;

  // Resolve the target into one of the schema's id columns. We accept
  // slugs to keep the client code simple — the slug → id lookup is
  // cheap (every table has an indexed slug or pk).
  const resolution = await resolveTargetId(kind, targetId);
  if (!resolution.ok) {
    return fail("target_not_found", resolution.reason, 404);
  }

  // Throttle: one report per (reporter, kind, target) per 24h.
  const dupeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const duplicate = await db.contentReport.findFirst({
    where: {
      reporterId: session.user.id,
      kind,
      shopId: resolution.shopId ?? null,
      productId: resolution.productId ?? null,
      reviewId: resolution.reviewId ?? null,
      storyId: resolution.storyId ?? null,
      liveCommentId: resolution.liveCommentId ?? null,
      createdAt: { gte: dupeSince },
    },
    select: { id: true },
  });
  if (duplicate) {
    return ok({ alreadyReported: true });
  }

  await db.contentReport.create({
    data: {
      reporterId: session.user.id,
      kind,
      reason,
      note: note?.trim() || null,
      shopId: resolution.shopId ?? null,
      productId: resolution.productId ?? null,
      reviewId: resolution.reviewId ?? null,
      storyId: resolution.storyId ?? null,
      liveCommentId: resolution.liveCommentId ?? null,
    },
  });

  return ok({ reported: true });
}

interface Resolution {
  ok: true;
  shopId?: string;
  productId?: string;
  reviewId?: string;
  storyId?: string;
  liveCommentId?: string;
}
interface NotFound {
  ok: false;
  reason: string;
}

async function resolveTargetId(
  kind: ContentReportKind,
  targetId: string,
): Promise<Resolution | NotFound> {
  switch (kind) {
    case ContentReportKind.SHOP: {
      const shop = await db.shop.findFirst({
        where: { OR: [{ id: targetId }, { slug: targetId }] },
        select: { id: true },
      });
      if (!shop) return { ok: false, reason: "ไม่พบร้านนี้" };
      return { ok: true, shopId: shop.id };
    }
    case ContentReportKind.PRODUCT: {
      const product = await db.product.findFirst({
        where: { OR: [{ id: targetId }, { slug: targetId }] },
        select: { id: true, shopId: true },
      });
      if (!product) return { ok: false, reason: "ไม่พบสินค้านี้" };
      return { ok: true, productId: product.id, shopId: product.shopId };
    }
    case ContentReportKind.REVIEW: {
      const review = await db.review.findUnique({
        where: { id: targetId },
        select: { id: true, shopId: true },
      });
      if (!review) return { ok: false, reason: "ไม่พบรีวิวนี้" };
      return { ok: true, reviewId: review.id, shopId: review.shopId };
    }
    case ContentReportKind.STORY: {
      // Story id passed by the caller. We accept by id only.
      return { ok: true, storyId: targetId };
    }
    case ContentReportKind.LIVE_COMMENT: {
      // Live-comment id passed by the caller.
      return { ok: true, liveCommentId: targetId };
    }
  }
}
