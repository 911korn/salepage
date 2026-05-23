import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  db,
  ProductBadge,
  ProductStatus,
  ProductType,
} from "@/lib/db";
import { getShopBySlug as getDemoShop } from "@/lib/demo-data";

/**
 * GET — public list of products for a shop.
 * - First tries the DB for real shops.
 * - Falls back to demo data so the landing's siam-snack preview keeps working.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });

  if (shop && shop.status === "ACTIVE") {
    const products = await db.product.findMany({
      where: { shopId: shop.id, status: { not: ProductStatus.HIDDEN } },
      orderBy: { createdAt: "desc" },
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
    });
    return ok({
      products: products.map((p) => ({
        slug: p.slug,
        name: p.name,
        description: p.description,
        price: p.priceSatang / 100,
        compareAt: p.compareAtSatang ? p.compareAtSatang / 100 : undefined,
        images: p.imageUrls,
        badge: p.badge,
        type: p.type.toLowerCase() as Lowercase<ProductType>,
        stock: p.stock,
        sold: p.sold,
      })),
    });
  }

  const demo = getDemoShop(slug);
  if (demo) return ok({ products: demo.products });
  return fail("not_found", "ไม่พบร้านค้านี้", 404);
}

/**
 * POST — create a new product. Requires sign-in + shop ownership.
 */
const Body = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "kebab-case ASCII only")
    .optional(),
  description: z.string().max(2000).optional(),
  /** THB price (will be stored as satang). Use whole baht — fractional THB rare. */
  priceBaht: z.number().int().positive().max(9_999_999),
  compareAtBaht: z.number().int().positive().max(9_999_999).optional(),
  imageUrls: z.array(z.string().url()).max(10).optional(),
  badge: z.enum(["HOT", "NEW", "SALE"]).optional().nullable(),
  type: z.enum(["PHYSICAL", "DIGITAL"]).default("PHYSICAL"),
  stock: z.number().int().nonnegative().max(99999).optional(),
});

// Collapse non-[a-z0-9] runs to hyphens, trim, clamp to 60 chars. Fallback to
// "p-<random>" when the source name is non-ASCII (Thai-only, emoji-only, etc.)
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) ||
    "p-" + Math.random().toString(36).slice(2, 10)
  );
}

export async function POST(
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
  if (shop.ownerId !== session.user.id) {
    return fail("forbidden", "ไม่มีสิทธิ์เพิ่มสินค้าในร้านนี้", 403);
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  let productSlug = input.slug ?? slugify(input.name);
  for (let i = 0; i < 3; i++) {
    const existing = await db.product.findUnique({
      where: { shopId_slug: { shopId: shop.id, slug: productSlug } },
    });
    if (!existing) break;
    productSlug = `${input.slug ?? slugify(input.name)}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  const product = await db.product.create({
    data: {
      shopId: shop.id,
      slug: productSlug,
      name: input.name,
      description: input.description,
      priceSatang: input.priceBaht * 100,
      compareAtSatang: input.compareAtBaht ? input.compareAtBaht * 100 : null,
      imageUrls: input.imageUrls ?? [],
      badge: input.badge ? (input.badge as ProductBadge) : null,
      type: input.type as ProductType,
      stock: input.stock ?? null,
      status: ProductStatus.ACTIVE,
    },
  });

  return ok({ product }, { status: 201 });
}
