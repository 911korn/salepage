import { z } from "zod";
import { resolveSession } from "@/lib/api-auth";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";

/**
 * POST   /api/v1/blocks   — block a user (by shop slug → resolves to owner)
 * DELETE /api/v1/blocks   — unblock
 *
 * Apple Guideline 1.2 — UGC moderation requires "a mechanism for users
 * to block abusive users. Blocking should also notify the developer of
 * the inappropriate content and should remove it from the user's feed
 * instantly."
 *
 * Implementation:
 * - Look up the target shop's ownerId.
 * - Upsert UserBlock(blocker = current user, blockee = ownerId).
 * - Auto-file a ContentReport (kind=SHOP, reason=HARASSMENT) so the
 *   admin queue is notified of the block (Apple's "notify the developer"
 *   requirement). Throttled to one report per 24h via the unique index.
 * - The buyer-facing feed (storefront, search, follow list) checks
 *   UserBlock at query time and excludes blocked shops — that's the
 *   "remove from user's feed instantly" requirement.
 */
const Body = z.object({
  shopSlug: z.string().min(1).max(120),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { shopSlug } = parsed.data;

  const shop = await db.shop.findFirst({
    where: { OR: [{ id: shopSlug }, { slug: shopSlug }] },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);
  if (shop.ownerId === session.user.id) {
    return fail("self_block", "บล็อกตัวเองไม่ได้", 400);
  }

  await db.userBlock.upsert({
    where: {
      blockerId_blockeeId: {
        blockerId: session.user.id,
        blockeeId: shop.ownerId,
      },
    },
    create: {
      blockerId: session.user.id,
      blockeeId: shop.ownerId,
    },
    update: {},
  });

  // Apple's "notify the developer" — auto-file a report so the admin
  // queue picks it up alongside explicit flags. Idempotent via the
  // 24h throttle in /api/v1/reports.
  const dupeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await db.contentReport.findFirst({
    where: {
      reporterId: session.user.id,
      kind: "SHOP",
      shopId: shop.id,
      createdAt: { gte: dupeSince },
    },
    select: { id: true },
  });
  if (!existing) {
    await db.contentReport.create({
      data: {
        reporterId: session.user.id,
        kind: "SHOP",
        reason: "HARASSMENT",
        note: "Auto-filed when user blocked this shop.",
        shopId: shop.id,
      },
    });
  }

  return ok({ blocked: true });
}

export async function DELETE(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { shopSlug } = parsed.data;

  const shop = await db.shop.findFirst({
    where: { OR: [{ id: shopSlug }, { slug: shopSlug }] },
    select: { ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);

  await db.userBlock.deleteMany({
    where: {
      blockerId: session.user.id,
      blockeeId: shop.ownerId,
    },
  });

  return ok({ blocked: false });
}
