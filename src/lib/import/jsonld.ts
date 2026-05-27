import * as cheerio from "cheerio";
import { REAL_CHROME_HEADERS } from "./headers";
import type { ImportedProduct } from "./types";
import { tempIdFor } from "./util";

/**
 * Generic importer — any e-commerce page that publishes JSON-LD Product
 * schema. Used as a fallback after Shopee/Lazada detection misses.
 *
 * Covers: TikTok Shop, Instagram Shopping, Shopify storefronts, WooCommerce,
 * BigCommerce, Squarespace, Magento, and most CMS-built shops.
 */
interface JsonLdProduct {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  image?: string | string[];
  offers?:
    | {
        price?: number | string;
        priceCurrency?: string;
        availability?: string;
        priceValidUntil?: string;
      }
    | Array<{ price?: number | string; priceCurrency?: string; availability?: string }>;
  brand?: { name?: string };
  sku?: string;
}

function readPrice(value: number | string | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.]/g, "");
    const n = Number.parseFloat(cleaned);
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return 0;
}

function isProductSchema(node: JsonLdProduct): boolean {
  const t = node["@type"];
  if (typeof t === "string") return t === "Product";
  if (Array.isArray(t)) return t.includes("Product");
  return false;
}

export async function fetchJsonLdProduct(url: string): Promise<ImportedProduct> {
  const res = await fetch(url, {
    headers: REAL_CHROME_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`เว็บเป้าหมายตอบกลับ ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Walk every JSON-LD block, follow @graph arrays, pick the first Product.
  const blocks = $('script[type="application/ld+json"]').toArray();
  let product: JsonLdProduct | null = null;
  for (const block of blocks) {
    const txt = $(block).contents().text();
    let json: unknown;
    try {
      json = JSON.parse(txt);
    } catch {
      continue;
    }
    const candidates = flatten(json);
    for (const c of candidates) {
      if (c && typeof c === "object" && isProductSchema(c as JsonLdProduct)) {
        product = c as JsonLdProduct;
        break;
      }
    }
    if (product) break;
  }

  if (!product) {
    // Final fallback: OpenGraph + meta tags. Gives us name + image + maybe
    // a `product:price:amount` meta from Facebook Shop integrations.
    const name = $('meta[property="og:title"]').attr("content") ?? "";
    const description = $('meta[property="og:description"]').attr("content") ?? "";
    const image = $('meta[property="og:image"]').attr("content") ?? "";
    const ogPrice = $('meta[property="product:price:amount"]').attr("content");
    if (!name) {
      throw new Error("ไม่พบข้อมูลสินค้า JSON-LD ในหน้านี้");
    }
    return {
      tempId: tempIdFor(`og-${url}`),
      name: name.trim(),
      description: description.trim() || null,
      priceSatang: ogPrice ? readPrice(ogPrice) : 0,
      compareAtSatang: null,
      shippingFeeSatang: 0,
      imageUrls: image ? [image] : [],
      stock: null,
      type: "PHYSICAL",
      source: "url-jsonld",
      sourceUrl: url,
      warnings: ogPrice
        ? []
        : ["ราคาไม่ระบุ — กรุณาเพิ่มราคาก่อนนำเข้า"],
    };
  }

  const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const priceSatang = readPrice(offers?.price);

  const images: string[] = [];
  if (typeof product.image === "string") images.push(product.image);
  else if (Array.isArray(product.image)) images.push(...product.image.filter((s) => typeof s === "string"));

  const warnings: string[] = [];
  if (priceSatang === 0) warnings.push("ราคา 0 — JSON-LD ไม่ระบุ");

  return {
    tempId: tempIdFor(`jsonld-${url}`),
    name: (product.name || "").trim() || "Untitled",
    description: (product.description || "").trim() || null,
    priceSatang,
    compareAtSatang: null,
    shippingFeeSatang: 0,
    imageUrls: images.filter((u) => u.startsWith("http")),
    stock: null,
    type: "PHYSICAL",
    source: "url-jsonld",
    sourceUrl: url,
    warnings,
  };
}

/**
 * JSON-LD often nests products inside @graph arrays or root arrays. Flatten
 * everything down to a search-ready list. Bounded to 50 items so a deeply
 * nested @graph can't DoS us.
 */
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
