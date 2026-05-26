import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db, DisputeStatus, OrderStatus } from "@/lib/db";
import { hasBusinessPlan } from "@/lib/plan";
import { getShopBySlug as getDemoShop } from "@/lib/demo-data";

const CATEGORIES = [
  "fashion",
  "food",
  "tech",
  "beauty",
  "health",
  "furniture",
  "pets",
  "books",
  "sport",
  "other",
] as const;

const PatchBody = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(280).optional().nullable(),
  category: z.enum(CATEGORIES).optional().nullable(),
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #e11d48")
    .optional(),
  logoText: z.string().max(2).optional().nullable(),
  logoUrl: z.string().url().max(500).optional().nullable(),
  promptpayId: z.string().min(9).max(20).optional().nullable(),
  contact: z
    .object({
      phone: z.string().max(40).optional().nullable(),
      line: z.string().max(60).optional().nullable(),
      facebook: z.string().max(200).optional().nullable(),
    })
    .optional(),
  policies: z
    .object({
      returnPolicy: z.string().max(500).optional().nullable(),
      shippingTime: z.string().max(120).optional().nullable(),
    })
    .optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  announcement: z.string().max(240).optional().nullable(),
  loyaltyBahtPerPoint: z.number().int().min(0).max(100000).optional(),
  loyaltyBahtValuePerPoint: z.number().int().min(0).max(1000).optional(),
  // LINE Messaging API (Business+ only — gated below)
  lineChannelId: z.string().max(64).optional().nullable(),
  lineChannelSecret: z.string().max(128).optional().nullable(),
  lineChannelAccessToken: z.string().max(500).optional().nullable(),
  lineWebhookEnabled: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  // 1) Try DB. Pull the catalog inline (`include products`) since the mobile
  // reads `data.shop` and `data.products` from a single round-trip.
  const shop = await db.shop.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      logoText: true,
      logoUrl: true,
      category: true,
      themeColor: true,
      verified: true,
      kycStatus: true,
      kycVerifiedAt: true,
      trustScore: true,
      rating: true,
      totalSold: true,
      bannerUrls: true,
      contact: true,
      announcement: true,
      status: true,
      createdAt: true,
      // V1.5 Protected Pay opt-in — surfaced on storefront as a shield badge
      // and as the checkout toggle gate.
      acceptsEscrow: true,
      products: {
        where: { status: "ACTIVE" },
        orderBy: [{ sold: "desc" }, { createdAt: "desc" }],
        take: 60,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          priceSatang: true,
          compareAtSatang: true,
          imageUrls: true,
          badge: true,
          type: true,
          stock: true,
          sold: true,
          status: true,
        },
      },
      _count: { select: { products: true } },
    },
  });

  if (shop && shop.status === "ACTIVE") {
    // Public dispute trust signal: ratio of disputed orders to delivered+
    // shipping over the last 90 days. We deliberately ignore CANCELLED in
    // the denominator because those never had a chance to be disputed.
    // Capped at 0–100; 0 displays as "no disputes".
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [disputeCount, deliveredOrderCount] = await Promise.all([
      db.dispute.count({
        where: {
          order: { shopId: shop.id },
          createdAt: { gte: ninetyDaysAgo },
          // Don't count NO_ACTION (buyer was wrong) toward the public stat —
          // only count refund/replace + still-open ones since those represent
          // real shop-side issues.
          status: {
            in: [
              DisputeStatus.OPEN,
              DisputeStatus.AWAITING_SHOP_RESPONSE,
              DisputeStatus.AWAITING_BUYER_RESPONSE,
              DisputeStatus.RESOLVED_REFUND,
              DisputeStatus.RESOLVED_REPLACE,
            ],
          },
        },
      }),
      db.order.count({
        where: {
          shopId: shop.id,
          status: {
            in: [
              OrderStatus.SHIPPING,
              OrderStatus.DELIVERED,
            ],
          },
          createdAt: { gte: ninetyDaysAgo },
        },
      }),
    ]);

    const disputeRatePct =
      deliveredOrderCount > 0
        ? Math.round((disputeCount / deliveredOrderCount) * 1000) / 10 // 1 decimal
        : 0;

    return ok({
      shop: {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        description: shop.description,
        logoText: shop.logoText,
        logoUrl: shop.logoUrl,
        bannerUrls: shop.bannerUrls,
        category: shop.category,
        themeColor: shop.themeColor,
        verified: shop.verified,
        kycStatus: shop.kycStatus,
        kycVerifiedAt: shop.kycVerifiedAt,
        trustScore: shop.trustScore,
        rating: shop.rating,
        totalSold: shop.totalSold,
        contact: shop.contact ?? null,
        announcement: shop.announcement,
        acceptsEscrow: shop.acceptsEscrow,
        // V1.6: public dispute stats over the last 90 days. UI shows the
        // pill only when `count > 0` so trustworthy shops aren't penalized
        // by having an empty "0% disputed" badge.
        disputeStats: {
          count: disputeCount,
          deliveredCount: deliveredOrderCount,
          ratePct: disputeRatePct,
          windowDays: 90,
        },
      },
      products: shop.products,
      productCount: shop._count.products,
      createdAt: shop.createdAt,
    });
  }

  // 2) Fall back to demo data for `/s/siam-snack` etc.
  const demo = getDemoShop(slug);
  if (demo) {
    return ok({
      shop: {
        id: `demo-${demo.slug}`,
        slug: demo.slug,
        name: demo.name,
        description: demo.description,
        logoText: demo.logo,
        logoUrl: null,
        bannerUrls: demo.banners,
        category: demo.category,
        themeColor: demo.themeColor,
        verified: demo.verified,
        kycStatus: demo.verified ? "VERIFIED" : "NONE",
        kycVerifiedAt: null,
        trustScore: demo.verified ? 80 : 50,
        rating: demo.rating,
        totalSold: demo.totalSold,
        contact: demo.contact ?? null,
        announcement: null,
        disputeStats: {
          count: 0,
          deliveredCount: 0,
          ratePct: 0,
          windowDays: 90,
        },
      },
      products: demo.products ?? [],
      productCount: demo.productCount,
      createdAt: null,
    });
  }

  return fail("not_found", "ไม่พบร้านค้านี้", 404);
}

/**
 * PATCH /api/v1/shops/:slug — owner-only edit of shop info.
 * Used by /dashboard/settings to update name, branding, payment, contact, policies.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Sign in required", 401);

  const { slug } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const parsed = await parseJson(request, PatchBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Plan gate: LINE Messaging API is Business+ only
  const touchingLine =
    input.lineChannelId !== undefined ||
    input.lineChannelSecret !== undefined ||
    input.lineChannelAccessToken !== undefined ||
    input.lineWebhookEnabled !== undefined;
  if (touchingLine) {
    const ok2 = await hasBusinessPlan(session.user.id);
    if (!ok2) {
      return fail(
        "plan_required",
        "ฟีเจอร์ LINE Messaging Inbox ต้องอัปเกรดเป็นแพ็กเกจ Business ขึ้นไป",
        402,
      );
    }
  }

  const updated = await db.shop.update({
    where: { id: shop.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.themeColor !== undefined
        ? { themeColor: input.themeColor }
        : {}),
      ...(input.logoText !== undefined ? { logoText: input.logoText } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.promptpayId !== undefined
        ? { promptpayId: input.promptpayId }
        : {}),
      ...(input.contact !== undefined ? { contact: input.contact } : {}),
      ...(input.policies !== undefined ? { policies: input.policies } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.announcement !== undefined
        ? { announcement: input.announcement }
        : {}),
      ...(input.loyaltyBahtPerPoint !== undefined
        ? { loyaltyBahtPerPoint: input.loyaltyBahtPerPoint }
        : {}),
      ...(input.loyaltyBahtValuePerPoint !== undefined
        ? { loyaltyBahtValuePerPoint: input.loyaltyBahtValuePerPoint }
        : {}),
      ...(input.lineChannelId !== undefined
        ? { lineChannelId: input.lineChannelId }
        : {}),
      ...(input.lineChannelSecret !== undefined
        ? { lineChannelSecret: input.lineChannelSecret }
        : {}),
      ...(input.lineChannelAccessToken !== undefined
        ? { lineChannelAccessToken: input.lineChannelAccessToken }
        : {}),
      ...(input.lineWebhookEnabled !== undefined
        ? { lineWebhookEnabled: input.lineWebhookEnabled }
        : {}),
    },
  });
  return ok({ shop: updated });
}
