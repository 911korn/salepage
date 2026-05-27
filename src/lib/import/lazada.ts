import * as cheerio from "cheerio";
import { layeredFetch } from "./headers";
import type { ImportedProduct } from "./types";
import { tempIdFor } from "./util";

/**
 * Lazada product page importer.
 *
 * Strategy (in order, first hit wins for each field):
 *  1. JSON-LD Product schema — Lazada PDPs embed this consistently for
 *     name, image gallery, description, brand. Sometimes includes price
 *     (offers.price) but flash-sale pages often omit it.
 *  2. Embedded `pdt_price` regex — Lazada's tracker scripts always carry
 *     the actual displayed price in a JSON blob like
 *     `"pdt_price":"฿570.00"`. Robust against React render order.
 *  3. OpenGraph `<meta>` — last-resort name/image fallback.
 *
 * We also strip the `| Lazada.co.th` suffix from titles before saving.
 */
export function isLazadaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /lazada\.co\.th|lazada\.com\.my|lazada\.sg|lazada\.com\.ph|lazada\.vn|lazada\.co\.id/.test(
      u.hostname,
    );
  } catch {
    return false;
  }
}

interface JsonLdProductSchema {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  image?: string | string[];
  offers?: {
    price?: number | string;
    priceCurrency?: string;
  };
}

function stripLazadaSuffix(name: string): string {
  return name.replace(/\s*\|\s*Lazada(\.co\.th)?\s*$/i, "").trim();
}

function priceFromString(value: string | number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[฿\s,]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

function lazadaImageUrl(src: string): string {
  // JSON-LD images come back as protocol-relative `//th-test-11.slatic.net/...`
  if (src.startsWith("//")) return `https:${src}`;
  return src;
}

/**
 * Walk every JSON-LD block on the page and return the first Product node
 * (including @graph-nested ones).
 */
function findJsonLdProduct($: cheerio.CheerioAPI): JsonLdProductSchema | null {
  const blocks = $('script[type="application/ld+json"]').toArray();
  for (const block of blocks) {
    const txt = $(block).contents().text();
    let json: unknown;
    try {
      json = JSON.parse(txt);
    } catch {
      continue;
    }
    const nodes = flatten(json);
    for (const n of nodes) {
      if (n && typeof n === "object" && isProduct(n as JsonLdProductSchema)) {
        return n as JsonLdProductSchema;
      }
    }
  }
  return null;
}

function isProduct(n: JsonLdProductSchema): boolean {
  const t = n["@type"];
  if (typeof t === "string") return t === "Product";
  if (Array.isArray(t)) return t.includes("Product");
  return false;
}

function flatten(node: unknown, depth = 0, acc: unknown[] = []): unknown[] {
  if (acc.length >= 50 || depth > 3) return acc;
  if (Array.isArray(node)) {
    for (const v of node) flatten(v, depth + 1, acc);
    return acc;
  }
  if (node && typeof node === "object") {
    acc.push(node);
    const graph = (node as { "@graph"?: unknown[] })["@graph"];
    if (Array.isArray(graph)) flatten(graph, depth + 1, acc);
  }
  return acc;
}

export async function fetchLazadaProduct(url: string): Promise<ImportedProduct> {
  const { html, status } = await layeredFetch(url);
  if (status >= 400) {
    throw new Error(`Lazada ตอบกลับ ${status} — อาจถูก anti-bot บล็อก`);
  }
  const $ = cheerio.load(html);
  const ld = findJsonLdProduct($);

  // Name
  let name = stripLazadaSuffix(ld?.name?.trim() ?? "");
  if (!name) {
    name = stripLazadaSuffix(
      ($('meta[property="og:title"]').attr("content") ?? "").trim(),
    );
  }
  if (!name) {
    throw new Error("ไม่พบชื่อสินค้าในหน้า Lazada");
  }

  // Description
  let description = (ld?.description ?? "").trim();
  if (!description) {
    description = ($('meta[property="og:description"]').attr("content") ?? "").trim();
  }
  description = description.replace(/\s+/g, " ").trim() || "";

  // Images — JSON-LD gives us the full gallery
  const imageUrls: string[] = [];
  if (typeof ld?.image === "string") imageUrls.push(lazadaImageUrl(ld.image));
  else if (Array.isArray(ld?.image)) {
    for (const i of ld.image) {
      if (typeof i === "string") imageUrls.push(lazadaImageUrl(i));
    }
  }
  if (imageUrls.length === 0) {
    const og = $('meta[property="og:image"]').attr("content");
    if (og) imageUrls.push(lazadaImageUrl(og));
  }

  // Price — try JSON-LD offers first, then regex against embedded JSON blobs
  let priceSatang = priceFromString(ld?.offers?.price);
  if (priceSatang === 0) {
    const m =
      html.match(/"pdt_price"\s*:\s*"([^"]+)"/) ??
      html.match(/\\"pdt_price\\":\\"([^"\\]+)\\"/) ??
      html.match(/"price"\s*:\s*"(฿[^"]+)"/);
    if (m) priceSatang = priceFromString(m[1]);
  }

  // Compare-at (sale strikethrough) — Lazada renders it as `originalPriceText`
  // in some templates and `lineThroughPrice` in others. We accept either.
  let compareAtSatang: number | null = null;
  const orig =
    html.match(/"originalPriceText"\s*:\s*"([^"]+)"/) ??
    html.match(/"lineThroughPrice"\s*:\s*"([^"]+)"/) ??
    html.match(/\\"originalPriceText\\":\\"([^"\\]+)\\"/);
  if (orig) {
    const c = priceFromString(orig[1]);
    if (c > priceSatang) compareAtSatang = c;
  }

  const warnings: string[] = [];
  if (priceSatang === 0) warnings.push("ราคา 0 — Lazada อาจไม่เปิดเผยราคาผ่าน metadata");
  if (imageUrls.length === 0) warnings.push("ไม่พบรูปสินค้า");

  return {
    tempId: tempIdFor(`lazada-${url}`),
    name,
    description: description || null,
    priceSatang,
    compareAtSatang,
    shippingFeeSatang: 0,
    imageUrls,
    stock: null,
    type: "PHYSICAL",
    source: "url-lazada",
    sourceUrl: url,
    warnings,
  };
}
