import "server-only";
import { db } from "@/lib/db";
import { rehostImages } from "./image-rehost";
import { slugify } from "./util";
import type { ImportedProduct } from "./types";

/**
 * Commit a batch of normalized imported products into a given shop.
 *
 * Behavior:
 * - Each row's images are re-hosted to Vercel Blob first (concurrency 4).
 * - Slugs collide? Append `-2`, `-3` until unique within the shop.
 * - Insert one product at a time so a single malformed row doesn't roll
 *   back the whole batch — return per-row outcomes for the dashboard.
 * - No-op on rows with no `name` or `priceSatang === 0` (caller should
 *   filter these in the preview, but we double-guard server-side).
 */
export interface CommitResult {
  created: Array<{ tempId: string; slug: string; name: string }>;
  skipped: Array<{ tempId: string; reason: string }>;
}

export async function commitImportedProducts(
  shopId: string,
  products: ImportedProduct[],
  opts: { rehostImages?: boolean } = {},
): Promise<CommitResult> {
  const created: CommitResult["created"] = [];
  const skipped: CommitResult["skipped"] = [];

  // Pre-load existing slugs for this shop so we can resolve collisions in
  // one query instead of N round trips. We'll still re-check inside the
  // insert (race-safe via @@unique index) but this saves a query/row.
  const existing = await db.product.findMany({
    where: { shopId },
    select: { slug: true },
  });
  const slugSet = new Set(existing.map((p) => p.slug));

  for (const p of products) {
    if (!p.name.trim() || p.priceSatang <= 0) {
      skipped.push({
        tempId: p.tempId,
        reason: !p.name.trim() ? "ไม่มีชื่อสินค้า" : "ราคาต้องมากกว่า 0",
      });
      continue;
    }

    const finalImages =
      opts.rehostImages === false
        ? p.imageUrls
        : await rehostImages(p.imageUrls, shopId);

    const baseSlug = slugify(p.name) || `product-${p.tempId}`;
    let slug = baseSlug;
    let n = 2;
    while (slugSet.has(slug)) {
      slug = `${baseSlug}-${n++}`;
    }
    slugSet.add(slug);

    try {
      const product = await db.product.create({
        data: {
          shopId,
          slug,
          name: p.name.trim(),
          description: p.description,
          priceSatang: p.priceSatang,
          compareAtSatang: p.compareAtSatang,
          imageUrls: finalImages,
          stock: p.stock,
          type: p.type,
          shippingFeeSatang: p.shippingFeeSatang,
          status: "ACTIVE",
        },
        select: { slug: true, name: true },
      });
      created.push({ tempId: p.tempId, slug: product.slug, name: product.name });
    } catch (e) {
      skipped.push({
        tempId: p.tempId,
        reason: e instanceof Error ? e.message : "สร้างสินค้าล้มเหลว",
      });
    }
  }

  return { created, skipped };
}
