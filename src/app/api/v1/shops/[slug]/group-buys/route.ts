import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, GroupBuyStatus } from "@/lib/db";
import { validateTiers } from "@/lib/group-buy";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/v1/shops/:slug/group-buys
 *
 * Public list of active + recently-filled campaigns for the shop. Surfaced
 * on the shop page so buyers see live group-buys without scrolling.
 *
 *   - ACTIVE (sorted by deadline asc — most urgent first)
 *   - FILLED in the last 7 days (social proof: "เคยเต็มเร็ว")
 *
 * EXPIRED + CANCELLED are hidden from the public list.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const groupBuys = await db.groupBuy.findMany({
    where: {
      shopId: shop.id,
      OR: [
        { status: GroupBuyStatus.ACTIVE, deadline: { gt: new Date() } },
        { status: GroupBuyStatus.FILLED, filledAt: { gte: sevenDaysAgo } },
      ],
    },
    orderBy: [{ status: "asc" }, { deadline: "asc" }],
    take: 12,
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
      product: {
        select: {
          slug: true,
          name: true,
          priceSatang: true,
          imageUrls: true,
        },
      },
    },
  });

  return ok({ groupBuys });
}

/**
 * POST /api/v1/shops/:slug/group-buys — owner-only.
 *
 * Create a new group buy campaign. Validates the tier-pricing schedule
 * (see `validateTiers`) so monotonicity invariants hold for the lifetime
 * of the campaign.
 */
const Body = z.object({
  productSlug: z.string().min(1).max(120),
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  minQty: z.number().int().min(2).max(10_000),
  maxQty: z.number().int().min(2).max(100_000).optional().nullable(),
  deadline: z.string().datetime(),
  tiers: z
    .array(
      z.object({
        minQty: z.number().int().min(1),
        priceSatang: z.number().int().min(1),
      }),
    )
    .max(5)
    .optional(),
});

export async function POST(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);
  if (shop.ownerId !== session.user.id) {
    return fail("forbidden", "เฉพาะเจ้าของร้านเท่านั้น", 403);
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Deadline must be in the future and not absurdly far out (capped at 30
  // days so we don't accumulate dead campaigns indefinitely).
  const deadline = new Date(input.deadline);
  const now = new Date();
  if (deadline.getTime() <= now.getTime() + 30 * 60 * 1000) {
    return fail("deadline_too_soon", "Deadline ต้องอยู่ในอนาคต ≥ 30 นาที", 422);
  }
  if (deadline.getTime() > now.getTime() + 30 * 24 * 60 * 60 * 1000) {
    return fail("deadline_too_far", "Deadline ห่างเกิน 30 วันไม่ได้", 422);
  }
  if (input.maxQty !== null && input.maxQty !== undefined && input.maxQty < input.minQty) {
    return fail("invalid_max_qty", "maxQty ต้องมากกว่าหรือเท่ากับ minQty", 422);
  }

  const product = await db.product.findUnique({
    where: {
      shopId_slug: { shopId: shop.id, slug: input.productSlug },
    },
    select: { id: true, priceSatang: true, status: true },
  });
  if (!product || product.status === "HIDDEN") {
    return fail("product_not_found", "ไม่พบสินค้าหรือสินค้าถูกซ่อน", 404);
  }

  const tiersResult = validateTiers(
    input.tiers ?? [],
    input.minQty,
    product.priceSatang,
  );
  if (!tiersResult.ok) {
    return fail("invalid_tiers", tiersResult.reason, 422);
  }

  // Prevent overlapping ACTIVE campaigns on the same product. One product
  // can only have one live group buy at a time — otherwise inventory + price
  // accounting becomes a nightmare.
  const overlapping = await db.groupBuy.findFirst({
    where: {
      productId: product.id,
      status: GroupBuyStatus.ACTIVE,
      deadline: { gt: new Date() },
    },
    select: { id: true },
  });
  if (overlapping) {
    return fail(
      "active_campaign_exists",
      "สินค้านี้มี Group Buy ที่ยังเปิดอยู่ — ปิดอันเก่าก่อน",
      409,
    );
  }

  const created = await db.groupBuy.create({
    data: {
      shopId: shop.id,
      productId: product.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      minQty: input.minQty,
      maxQty: input.maxQty ?? null,
      // Prisma's Json type needs a plain serializable value, not our
      // typed PriceTier[] alias.
      tiers: JSON.parse(JSON.stringify(tiersResult.tiers)),
      deadline,
    },
    select: {
      id: true,
      title: true,
      minQty: true,
      maxQty: true,
      tiers: true,
      deadline: true,
      status: true,
      createdAt: true,
    },
  });

  return ok({ groupBuy: created }, { status: 201 });
}
