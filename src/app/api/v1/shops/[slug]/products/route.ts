import { ok, fail } from "@/lib/api";
import { getShopBySlug } from "@/lib/demo-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const shop = getShopBySlug(slug);
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  return ok({ products: shop.products });
}
