import { z } from "zod";
import { resolveSession } from "@/lib/api-auth";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { fetchProductsFromUrls } from "@/lib/import/url-import";
import { commitImportedProducts } from "@/lib/import/commit";
import type { ImportedProduct } from "@/lib/import/types";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/v1/shops/:slug/import/url
 *
 * `mode: "preview"` — fetch each URL via the matching platform extractor
 * (Shopee mobile API / Lazada __NEXT_DATA__ / JSON-LD fallback) and return
 * normalized product previews + per-URL failures.
 *
 * `mode: "commit"` — accept a user-curated list of ImportedProduct objects
 * (the dashboard lets sellers edit name/price/images before committing)
 * and insert them into the shop's catalogue.
 */
const PreviewBody = z.object({
  mode: z.literal("preview").default("preview"),
  urls: z.array(z.string().url()).min(1).max(50),
});

const ImportedProductSchema = z.object({
  tempId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().nullable(),
  priceSatang: z.number().int().min(0),
  compareAtSatang: z.number().int().min(0).nullable(),
  shippingFeeSatang: z.number().int().min(0),
  imageUrls: z.array(z.string().url()),
  stock: z.number().int().min(0).nullable(),
  type: z.enum(["PHYSICAL", "DIGITAL"]),
  source: z.enum([
    "csv-shopee",
    "csv-lazada",
    "csv-generic",
    "url-shopee",
    "url-lazada",
    "url-tiktok",
    "url-jsonld",
  ]),
  sourceUrl: z.string().url().nullable(),
  warnings: z.array(z.string()).default([]),
});

const CommitBody = z.object({
  mode: z.literal("commit"),
  products: z.array(ImportedProductSchema).min(1).max(50),
});

const Body = z.discriminatedUnion("mode", [PreviewBody, CommitBody]);

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  if (input.mode === "preview") {
    const result = await fetchProductsFromUrls(input.urls);
    return ok({
      successes: result.successes,
      failures: result.failures,
    });
  }

  // Commit mode
  const products = input.products as ImportedProduct[];
  const result = await commitImportedProducts(shop.id, products);
  return ok({
    createdCount: result.created.length,
    skippedCount: result.skipped.length,
    created: result.created,
    skipped: result.skipped,
  });
}
