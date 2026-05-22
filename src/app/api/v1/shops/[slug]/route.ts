import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { getShopBySlug as getDemoShop } from "@/lib/demo-data";

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
