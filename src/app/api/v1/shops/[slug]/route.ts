import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  // 1) Try DB
  const shop = await db.shop.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      description: true,
      logoText: true,
      category: true,
      themeColor: true,
      verified: true,
      rating: true,
      totalSold: true,
      bannerUrls: true,
      contact: true,
      status: true,
      _count: { select: { products: true } },
    },
  });

  if (shop && shop.status === "ACTIVE") {
    return ok({
      slug: shop.slug,
      name: shop.name,
      description: shop.description,
      logo: shop.logoText,
      category: shop.category,
      themeColor: shop.themeColor,
      verified: shop.verified,
      rating: shop.rating,
      productCount: shop._count.products,
      totalSold: shop.totalSold,
      contact: shop.contact ?? {},
      banners: shop.bannerUrls,
    });
  }

  // 2) Fall back to demo data for `/s/siam-snack` etc.
  const demo = getDemoShop(slug);
  if (demo) {
    return ok({
      slug: demo.slug,
      name: demo.name,
      description: demo.description,
      logo: demo.logo,
      category: demo.category,
      themeColor: demo.themeColor,
      verified: demo.verified,
      rating: demo.rating,
      productCount: demo.productCount,
      totalSold: demo.totalSold,
      contact: demo.contact,
      banners: demo.banners,
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
    },
  });
  return ok({ shop: updated });
}
