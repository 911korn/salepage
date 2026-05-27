import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, ProductBadge, ProductStatus, ProductType } from "@/lib/db";
import { getProduct as getDemoProduct } from "@/lib/demo-data";

interface RouteCtx {
  params: Promise<{ slug: string; productSlug: string }>;
}

/** GET — public product detail. DB first, demo fallback. */
export async function GET(_request: Request, context: RouteCtx) {
  const { slug, productSlug } = await context.params;

  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, status: true, slug: true },
  });
  if (shop && shop.status === "ACTIVE") {
    const p = await db.product.findUnique({
      where: { shopId_slug: { shopId: shop.id, slug: productSlug } },
    });
    if (p && p.status !== ProductStatus.HIDDEN) {
      return ok({
        slug: p.slug,
        name: p.name,
        description: p.description,
        price: p.priceSatang / 100,
        compareAt: p.compareAtSatang ? p.compareAtSatang / 100 : undefined,
        images: p.imageUrls,
        badge: p.badge,
        type: p.type.toLowerCase() as Lowercase<ProductType>,
        shippingFeeSatang: p.shippingFeeSatang,
        stock: p.stock,
        sold: p.sold,
        status: p.status,
      });
    }
  }

  const demo = getDemoProduct(slug, productSlug);
  if (demo) return ok(demo);
  return fail("not_found", "ไม่พบสินค้านี้", 404);
}

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  priceBaht: z.number().int().positive().max(9_999_999).optional(),
  compareAtBaht: z.number().int().positive().max(9_999_999).optional().nullable(),
  imageUrls: z.array(z.string().url()).max(10).optional(),
  badge: z.enum(["HOT", "NEW", "SALE"]).optional().nullable(),
  type: z.enum(["PHYSICAL", "DIGITAL"]).optional(),
  category: z.string().min(1).max(40).optional().nullable(),
  condition: z.enum(["NEW", "PRE_OWNED"]).optional(),
  digitalContent: z.string().max(5000).optional().nullable(),
  /// V2.1 per-product shipping fee in baht. Default 0 = free shipping.
  shippingFeeBaht: z.number().int().nonnegative().max(99_999).optional(),
  stock: z.number().int().nonnegative().max(99999).optional().nullable(),
  status: z.enum(["ACTIVE", "HIDDEN", "SOLD_OUT"]).optional(),
});

async function ensureOwnership(slug: string, userId: string) {
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return { error: fail("not_found", "ไม่พบร้านค้านี้", 404) };
  if (shop.ownerId !== userId)
    return { error: fail("forbidden", "ไม่มีสิทธิ์", 403) };
  return { shopId: shop.id };
}

export async function PATCH(request: Request, context: RouteCtx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug, productSlug } = await context.params;
  const own = await ensureOwnership(slug, session.user.id);
  if ("error" in own) return own.error;

  const parsed = await parseJson(request, PatchBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.priceBaht !== undefined) data.priceSatang = input.priceBaht * 100;
  if (input.compareAtBaht !== undefined)
    data.compareAtSatang =
      input.compareAtBaht === null ? null : input.compareAtBaht * 100;
  if (input.imageUrls !== undefined) data.imageUrls = input.imageUrls;
  if (input.badge !== undefined)
    data.badge = input.badge === null ? null : (input.badge as ProductBadge);
  if (input.type !== undefined) data.type = input.type as ProductType;
  if (input.category !== undefined)
    data.category = input.category === null ? null : input.category.trim() || null;
  if (input.condition !== undefined) data.condition = input.condition;
  if (input.digitalContent !== undefined) {
    data.digitalContent = input.digitalContent === null
      ? null
      : input.digitalContent.trim() || null;
  }
  if (input.shippingFeeBaht !== undefined) {
    // Force 0 for DIGITAL — either type was passed in this PATCH, or
    // we leave the toggling-back-to-PHYSICAL case to a follow-up PATCH.
    const forcedZero = input.type === "DIGITAL";
    data.shippingFeeSatang = forcedZero ? 0 : input.shippingFeeBaht * 100;
  }
  // If type was toggled to DIGITAL without an explicit shippingFee in this
  // PATCH, still zero the existing fee — never charge shipping on a digital.
  if (input.type === "DIGITAL" && input.shippingFeeBaht === undefined) {
    data.shippingFeeSatang = 0;
  }
  if (input.stock !== undefined) {
    data.stock = input.stock;
    // V2.1 — topping up restocks puts the listing back on the feed +
    // clears the SOLD_OUT timer. Only kicks in when seller raises stock
    // above 0; setting stock to 0 explicitly leaves it sold out.
    if (input.stock !== null && input.stock > 0) {
      data.soldOutAt = null;
      // Only auto-flip status if the product was SOLD_OUT — don't
      // override an explicit HIDDEN that the seller toggled separately.
      const existing = await db.product.findUnique({
        where: { shopId_slug: { shopId: own.shopId, slug: productSlug } },
        select: { status: true },
      });
      if (existing?.status === "SOLD_OUT") {
        data.status = "ACTIVE";
      }
    }
  }
  if (input.status !== undefined) data.status = input.status as ProductStatus;

  const product = await db.product.update({
    where: { shopId_slug: { shopId: own.shopId, slug: productSlug } },
    data,
  });
  return ok({ product });
}

export async function DELETE(request: Request, context: RouteCtx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug, productSlug } = await context.params;
  const own = await ensureOwnership(slug, session.user.id);
  if ("error" in own) return own.error;

  await db.product.delete({
    where: { shopId_slug: { shopId: own.shopId, slug: productSlug } },
  });
  return ok({ deleted: true });
}
