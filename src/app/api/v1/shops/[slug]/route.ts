import { ok, fail } from "@/lib/api";
import { getShopBySlug } from "@/lib/demo-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const shop = getShopBySlug(slug);
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  return ok({
    slug: shop.slug,
    name: shop.name,
    description: shop.description,
    logo: shop.logo,
    category: shop.category,
    themeColor: shop.themeColor,
    verified: shop.verified,
    rating: shop.rating,
    productCount: shop.productCount,
    totalSold: shop.totalSold,
    contact: shop.contact,
    banners: shop.banners,
  });
}
