import { ok, fail } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, GroupBuyStatus } from "@/lib/db";
import { parseTiers, priceForCurrentQty } from "@/lib/group-buy";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/group-buys/:id — public detail.
 *
 * Includes:
 *   - current campaign state (qty, deadline, status)
 *   - product snapshot (name, image, base price)
 *   - shop summary (link out to /s/:slug)
 *   - current tier + next tier (for the "ลด X% เมื่อรวม Y ชิ้น" hint)
 *
 * We deliberately don't expose the member list — buyers don't need to see
 * who joined, and it'd leak phone/name data.
 *
 * Buyer join lives at POST /api/v1/group-buys/:id/join (see ./join/route.ts)
 * so DELETE here unambiguously means "cancel campaign".
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const gb = await db.groupBuy.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      minQty: true,
      maxQty: true,
      currentQty: true,
      tiers: true,
      deadline: true,
      filledAt: true,
      expiredAt: true,
      createdAt: true,
      product: {
        select: {
          slug: true,
          name: true,
          description: true,
          priceSatang: true,
          imageUrls: true,
          status: true,
        },
      },
      shop: {
        select: {
          slug: true,
          name: true,
          logoText: true,
          logoUrl: true,
          themeColor: true,
          kycStatus: true,
        },
      },
    },
  });
  if (!gb) return fail("not_found", "ไม่พบ Group Buy นี้", 404);

  const tiers = parseTiers(gb.tiers);
  const currentPrice = priceForCurrentQty(
    tiers,
    gb.product.priceSatang,
    gb.currentQty,
  );
  const nextTier =
    tiers.find((t) => t.minQty > gb.currentQty) ?? null;

  return ok({
    groupBuy: {
      ...gb,
      tiers,
      currentPriceSatang: currentPrice,
      nextTier,
    },
  });
}

/**
 * DELETE /api/v1/group-buys/:id — owner-only.
 *
 * Cancels an ACTIVE campaign. Member orders fall into the auto-refund
 * sweep (same path as EXPIRED). Cannot cancel after FILLED — at that point
 * the buyer relationship is between shop + member, not the campaign.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { id } = await ctx.params;
  const gb = await db.groupBuy.findUnique({
    where: { id },
    select: { id: true, status: true, shop: { select: { ownerId: true } } },
  });
  if (!gb) return fail("not_found", "ไม่พบ Group Buy นี้", 404);
  if (gb.shop.ownerId !== session.user.id) {
    return fail("forbidden", "เฉพาะเจ้าของร้านเท่านั้น", 403);
  }
  if (gb.status !== GroupBuyStatus.ACTIVE) {
    return fail("not_active", `สถานะปัจจุบัน ${gb.status} ยกเลิกไม่ได้`, 409);
  }

  await db.groupBuy.update({
    where: { id },
    data: { status: GroupBuyStatus.CANCELLED, expiredAt: new Date() },
  });

  return ok({ id, status: GroupBuyStatus.CANCELLED });
}
