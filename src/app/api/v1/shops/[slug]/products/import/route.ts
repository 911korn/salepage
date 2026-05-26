import { ok, fail } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import {
  db,
  ProductBadge,
  ProductStatus,
  ProductType,
} from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { generateSlug } from "@/lib/dashboard";

interface ImportResult {
  row: number;
  ok: boolean;
  slug?: string;
  action?: "created" | "updated";
  error?: string;
}

/**
 * POST /api/v1/shops/:slug/products/import — owner-only bulk upsert from CSV.
 *
 * Accepts raw CSV in the request body (text/csv) OR a multipart form with a
 * "file" field. Header row required. Recognised columns (case-insensitive):
 *   slug (optional — derived from name if absent)
 *   name (required)
 *   description
 *   priceBaht (required, decimal allowed)
 *   compareAtBaht
 *   type            PHYSICAL | DIGITAL (default PHYSICAL)
 *   stock           integer or empty
 *   badge           HOT | NEW | SALE | empty
 *   status          ACTIVE | HIDDEN | SOLD_OUT (default ACTIVE)
 *   imageUrl        single URL — multiple images not supported via CSV v1
 *
 * Returns per-row results so the UI can highlight failures inline.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  // Accept text/csv OR multipart with field "file"
  let csv = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.startsWith("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return fail("missing_file", "แนบไฟล์ CSV ก่อน", 400);
    csv = await file.text();
  } else {
    csv = await request.text();
  }
  if (!csv.trim()) return fail("empty", "ไฟล์ว่าง", 400);

  const rows = parseCsv(csv);
  if (rows.length < 2)
    return fail("malformed", "ไฟล์ต้องมี header + อย่างน้อย 1 แถว", 400);

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const dataRows = rows.slice(1);

  const idx = (h: string) => headers.indexOf(h);
  const NAME = idx("name");
  if (NAME < 0)
    return fail("missing_name_column", "ไม่พบคอลัมน์ name", 400);
  const PRICE = idx("pricebaht");
  if (PRICE < 0)
    return fail("missing_price_column", "ไม่พบคอลัมน์ priceBaht", 400);

  const SLUG = idx("slug");
  const DESC = idx("description");
  const COMPARE = idx("compareatbaht");
  const TYPE = idx("type");
  const STOCK = idx("stock");
  const BADGE = idx("badge");
  const STATUS = idx("status");
  const IMAGE = idx("imageurl");

  const results: ImportResult[] = [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2; // 1-based + header
    const name = (row[NAME] ?? "").trim();
    if (!name) continue; // skip blank
    const priceRaw = (row[PRICE] ?? "").trim();
    const priceBaht = Number(priceRaw);
    if (!priceRaw || !Number.isFinite(priceBaht) || priceBaht < 0) {
      results.push({ row: rowNum, ok: false, error: `priceBaht ไม่ถูกต้อง: ${priceRaw}` });
      continue;
    }

    const baseSlug = (SLUG >= 0 ? row[SLUG]?.trim() : "") || generateSlug(name);
    const compareRaw = COMPARE >= 0 ? (row[COMPARE] ?? "").trim() : "";
    const compareBaht = compareRaw ? Number(compareRaw) : null;
    const stockRaw = STOCK >= 0 ? (row[STOCK] ?? "").trim() : "";
    const stock = stockRaw ? Number(stockRaw) : null;
    const badgeRaw = (BADGE >= 0 ? row[BADGE]?.trim() : "").toUpperCase();
    const typeRaw = (TYPE >= 0 ? row[TYPE]?.trim() : "PHYSICAL").toUpperCase();
    const statusRaw = (STATUS >= 0 ? row[STATUS]?.trim() : "ACTIVE").toUpperCase();
    const imageUrl = (IMAGE >= 0 ? row[IMAGE]?.trim() : "") || "";

    const type =
      typeRaw === "DIGITAL" ? ProductType.DIGITAL : ProductType.PHYSICAL;
    const status =
      statusRaw === "HIDDEN"
        ? ProductStatus.HIDDEN
        : statusRaw === "SOLD_OUT"
          ? ProductStatus.SOLD_OUT
          : ProductStatus.ACTIVE;
    const badge =
      badgeRaw === "HOT" || badgeRaw === "NEW" || badgeRaw === "SALE"
        ? (badgeRaw as ProductBadge)
        : null;

    const description = DESC >= 0 ? (row[DESC] ?? "").trim() || null : null;

    try {
      const existing = await db.product.findUnique({
        where: { shopId_slug: { shopId: shop.id, slug: baseSlug } },
        select: { id: true },
      });
      const data = {
        name,
        description,
        priceSatang: Math.round(priceBaht * 100),
        compareAtSatang:
          compareBaht && compareBaht > 0
            ? Math.round(compareBaht * 100)
            : null,
        imageUrls: imageUrl ? [imageUrl] : [],
        type,
        badge,
        stock,
        status,
      };
      if (existing) {
        await db.product.update({ where: { id: existing.id }, data });
        results.push({ row: rowNum, ok: true, slug: baseSlug, action: "updated" });
        updated++;
      } else {
        await db.product.create({
          data: { ...data, slug: baseSlug, shopId: shop.id },
        });
        results.push({ row: rowNum, ok: true, slug: baseSlug, action: "created" });
        created++;
      }
    } catch (e) {
      results.push({
        row: rowNum,
        ok: false,
        error: e instanceof Error ? e.message : "DB error",
      });
    }
  }

  return ok({
    total: results.length,
    created,
    updated,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
