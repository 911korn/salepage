import { z } from "zod";
import { resolveSession } from "@/lib/api-auth";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { parseSpreadsheet, rowsToProducts, type ColumnMap } from "@/lib/import/csv";
import { commitImportedProducts } from "@/lib/import/commit";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/v1/shops/:slug/import/csv
 *
 * Two modes:
 *  - `mode: "preview"` (default) — parse the CSV/XLSX text, auto-detect
 *     Shopee/Lazada/generic format, suggest column mapping, return up to
 *     50 rows so the dashboard can render a preview table.
 *  - `mode: "commit"` — accept a finalized column mapping + an explicit
 *     row index list (the dashboard lets the user uncheck rows) and
 *     create Product records in bulk.
 *
 * Body is JSON so we can ship the CSV as a base64-or-utf8 string. Multipart
 * upload would be cleaner but doesn't add value here — Shopee/Lazada
 * exports rarely exceed a few hundred KB.
 */
const PreviewBody = z.object({
  mode: z.literal("preview").default("preview"),
  /** UTF-8 CSV text OR base64-encoded XLSX bytes (auto-detected by header). */
  fileText: z.string().optional(),
  fileBase64: z.string().optional(),
});

const ColumnMapSchema = z.object({
  name: z.string().nullable(),
  description: z.string().nullable(),
  price: z.string().nullable(),
  compareAtPrice: z.string().nullable(),
  stock: z.string().nullable(),
  images: z.string().nullable(),
  shippingFee: z.string().nullable(),
});

const CommitBody = z.object({
  mode: z.literal("commit"),
  fileText: z.string().optional(),
  fileBase64: z.string().optional(),
  mapping: ColumnMapSchema,
  /** Optional subset — if omitted, commit every row. */
  selectedTempIds: z.array(z.string()).optional(),
});

const Body = z.discriminatedUnion("mode", [PreviewBody, CommitBody]);

export const runtime = "nodejs";
// CSV parses + Vercel Blob uploads + Prisma inserts can comfortably take
// 30 s for a 200-product Shopee export. Bump the function timeout to keep
// the import responsive for real-world catalogues.
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

  const buf = input.fileBase64 ? Buffer.from(input.fileBase64, "base64") : null;
  const text = input.fileText ?? null;
  if (!buf && !text) {
    return fail("invalid_input", "กรุณาแนบไฟล์ CSV หรือ XLSX", 400);
  }

  const parseResult = parseSpreadsheet(buf ?? text!);

  if (input.mode === "preview") {
    const productsAll = rowsToProducts(parseResult.rows, parseResult.mapping, parseResult.source);
    return ok({
      detected: parseResult.detected,
      mapping: parseResult.mapping,
      headers: parseResult.rows.length > 0 ? Object.keys(parseResult.rows[0]!) : [],
      totalRows: parseResult.rows.length,
      previewRows: productsAll.slice(0, 50),
      warnings: parseResult.warnings,
    });
  }

  // Commit mode
  const mapping: ColumnMap = input.mapping;
  const allProducts = rowsToProducts(parseResult.rows, mapping, parseResult.source);
  const selected = input.selectedTempIds
    ? allProducts.filter((p) => input.selectedTempIds!.includes(p.tempId))
    : allProducts;

  const result = await commitImportedProducts(shop.id, selected);
  return ok({
    createdCount: result.created.length,
    skippedCount: result.skipped.length,
    created: result.created,
    skipped: result.skipped,
  });
}
