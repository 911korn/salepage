import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { auth } from "@/lib/auth";
import { resolveSession } from "@/lib/api-auth";
import { db, DisputeStatus, OrderStatus } from "@/lib/db";
import { hasBusinessPlan } from "@/lib/plan";
import { getShopBySlug as getDemoShop } from "@/lib/demo-data";
import { verifyMobileJwt } from "@/lib/mobile-jwt";

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
  /**
   * Up to 3 banner image URLs. Renders on the home shop card + the shop page
   * hero. Owners can clear the array to fall back to the brand themeColor.
   */
  bannerUrls: z.array(z.string().url().max(500)).max(3).optional(),
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

/**
 * Resolve the current viewer's userId from either a mobile Bearer JWT or
 * the web Auth.js cookie session. Returns null for anonymous viewers;
 * we don't 401 here because this is a public GET — only privileged
 * fields (isFollowing, isFavorite) are gated on having a viewer.
 */
async function viewerId(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    const payload = await verifyMobileJwt(header.slice(7).trim());
    if (payload) return payload.sub;
  }
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const userId = await viewerId(request);

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
          category: true,
          condition: true,
          digitalContent: true,
          shippingFeeSatang: true,
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

    // Follower count + per-viewer isFollowing flag. Counts shipping with
    // the rest of the trust badges so social proof + own-state share one
    // DB round-trip rather than two.
    const followerCount = await db.shopFollow.count({
      where: { shopId: shop.id },
    });
    const isFollowing = userId
      ? Boolean(
          await db.shopFollow.findUnique({
            where: { userId_shopId: { userId, shopId: shop.id } },
            select: { userId: true },
          }),
        )
      : false;

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
        // Social-proof + viewer state for the Follow button on the shop
        // hero. `followerCount` is the public count (visible to anon);
        // `isFollowing` is null for anon and true/false when viewer is
        // signed in.
        followerCount,
        isFollowing,
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
        followerCount: 0,
        isFollowing: false,
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
  // 911korn 2026-05-27: seller mode in the mobile app sends JWT in the
  // Authorization header, not a Next-Auth cookie. The previous `auth()`-
  // only check returned 401 "Sign in required" to every mobile PATCH.
  // Use resolveSession which accepts both Bearer + cookie.
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

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
      ...(input.bannerUrls !== undefined
        ? { bannerUrls: input.bannerUrls }
        : {}),
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
