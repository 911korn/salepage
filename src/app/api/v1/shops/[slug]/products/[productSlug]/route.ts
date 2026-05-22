import { ok, fail } from "@/lib/api";
import { getProduct } from "@/lib/demo-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; productSlug: string }> },
) {
  const { slug, productSlug } = await context.params;
  const product = getProduct(slug, productSlug);
  if (!product) return fail("not_found", "ไม่พบสินค้านี้", 404);
  return ok(product);
}
