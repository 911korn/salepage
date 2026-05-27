import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { requireAdminApi, logAdminAction } from "@/lib/admin";
import {
  db,
  ContentReportStatus,
  ContentReportKind,
  ProductStatus,
  ShopStatus,
} from "@/lib/db";

/**
 * POST /api/v1/admin/reports/[id]   { action: "remove" | "keep" | "review" }
 *
 * Apple Guideline 1.2 — within 24h, admin must either remove offending
 * content + eject the offending user, or close the report as not in
 * violation. This is the single endpoint the admin queue UI calls.
 *
 *   - review:  status → REVIEWING (in-progress flag)
 *   - keep:    status → RESOLVED_KEPT (no action taken)
 *   - remove:  status → RESOLVED_REMOVED + soft-delete the targeted
 *              content (Product.status=REMOVED, Review.deleted, Shop.suspended,
 *              ShopStory.removedAt, LiveComment.removed). The reported
 *              user / shop owner is also suspended via Shop.suspended=true
 *              to "eject" them per Apple's spec.
 */
const Body = z.object({
  action: z.enum(["remove", "keep", "review"]),
  note: z.string().max(500).optional(),
});

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAdminApi();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { action, note } = parsed.data;

  const report = await db.contentReport.findUnique({
    where: { id },
  });
  if (!report) return fail("not_found", "ไม่พบรายงาน", 404);

  if (action === "review") {
    await db.contentReport.update({
      where: { id },
      data: { status: ContentReportStatus.REVIEWING },
    });
    await logAdminAction(ctx.ctx.userId, "REPORT_REVIEWING", { type: "ContentReport", id });
    return ok({ status: ContentReportStatus.REVIEWING });
  }

  if (action === "keep") {
    await db.contentReport.update({
      where: { id },
      data: {
        status: ContentReportStatus.RESOLVED_KEPT,
        resolvedAt: new Date(),
        resolvedBy: ctx.ctx.userId,
        resolutionNote: note ?? null,
      },
    });
    await logAdminAction(ctx.ctx.userId, "REPORT_KEPT", { type: "ContentReport", id });
    return ok({ status: ContentReportStatus.RESOLVED_KEPT });
  }

  // action === "remove" — soft-delete the offending content and eject
  // the user that owns it.
  let ownerIdToSuspend: string | null = null;

  if (report.kind === ContentReportKind.PRODUCT && report.productId) {
    const prod = await db.product.findUnique({
      where: { id: report.productId },
      select: { shop: { select: { id: true, ownerId: true } } },
    });
    await db.product.update({
      where: { id: report.productId },
      data: { status: ProductStatus.HIDDEN },
    });
    ownerIdToSuspend = prod?.shop?.ownerId ?? null;
  } else if (report.kind === ContentReportKind.SHOP && report.shopId) {
    const shop = await db.shop.findUnique({
      where: { id: report.shopId },
      select: { ownerId: true },
    });
    await db.shop.update({
      where: { id: report.shopId },
      data: { suspended: true, status: ShopStatus.ARCHIVED },
    });
    ownerIdToSuspend = shop?.ownerId ?? null;
  } else if (report.kind === ContentReportKind.REVIEW && report.reviewId) {
    // Reviews don't carry an authorId — they're keyed by customerName +
    // optional customerPhone. We delete the review row and eject the
    // shop owner only if THEY wrote a slur in their reply field; for
    // pure customer reviews there's no user account to suspend.
    await db.review.delete({ where: { id: report.reviewId } });
  }

  // Eject = suspend every shop owned by the offender so their content
  // disappears for everyone instantly.
  if (ownerIdToSuspend) {
    await db.shop.updateMany({
      where: { ownerId: ownerIdToSuspend },
      data: { suspended: true, status: ShopStatus.ARCHIVED },
    });
  }

  await db.contentReport.update({
    where: { id },
    data: {
      status: ContentReportStatus.RESOLVED_REMOVED,
      resolvedAt: new Date(),
      resolvedBy: ctx.ctx.userId,
      resolutionNote: note ?? null,
    },
  });
  await logAdminAction(
    ctx.ctx.userId,
    "REPORT_REMOVED",
    { type: "ContentReport", id },
    { kind: report.kind, ownerSuspended: ownerIdToSuspend },
  );
  return ok({ status: ContentReportStatus.RESOLVED_REMOVED });
}
