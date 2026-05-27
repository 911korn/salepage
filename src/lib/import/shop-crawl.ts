import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { REAL_CHROME_HEADERS } from "./headers";
import { fetchLazadaProduct, isLazadaUrl } from "./lazada";
import { fetchJsonLdProduct } from "./jsonld";
import { isShopeeUrl } from "./shopee";
import { tempIdFor } from "./util";
import type { ImportedProduct } from "./types";

/**
 * "Paste your shop link, AI does the rest" — the marketing-grade feature.
 *
 * Given a single shop landing URL, this module figures out the platform
 * and returns every product in the catalogue, normalized to the same
 * ImportedProduct shape the CSV + single-URL paths use.
 *
 * Coverage:
 *   1. Shopify storefronts — `/products.json?limit=250` is exposed by
 *      every Shopify shop (the API is on by default, even on the cheapest
 *      plan). One request returns up to 250 products with full metadata.
 *   2. Lazada shop pages — scrape the HTML listing, paginate up to 5
 *      pages, then run each individual product through the normal
 *      Lazada extractor for full data.
 *   3. Shopee shop pages — anti-bot blocks us. Surface the friendly
 *      "use CSV path" error.
 *   4. Anything else — fetch the HTML, strip nav/script noise, send to
 *      Claude with a JSON-extraction prompt. AI returns a list of
 *      products with name/price/image/url. The same flow then enriches
 *      each detected product URL through fetchJsonLdProduct() for the
 *      full description. This covers TikTok Shop, Instagram Shopping,
 *      WooCommerce, Squarespace, Magento, BigCommerce, and most CMS
 *      storefronts.
 */

export interface ShopCrawlResult {
  products: ImportedProduct[];
  failures: { url: string; reason: string }[];
  platform: "shopify" | "lazada" | "shopee" | "ai-extracted";
  /** Total products detected before any AI/regex trimming. */
  totalDetected: number;
}

const MAX_PRODUCTS = 100;

export async function crawlShopUrl(url: string): Promise<ShopCrawlResult> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("ลิงก์ร้านต้องขึ้นต้นด้วย http:// หรือ https://");
  }
  if (isShopeeUrl(url)) {
    throw new Error(
      'Shopee ป้องกัน import อัตโนมัติ · กรุณาใช้แท็บ "ไฟล์ Shopee/Lazada" ' +
        'แล้วส่งออกไฟล์ Excel จาก Shopee Seller Center → คลังสินค้าของฉัน → ส่งออก',
    );
  }
  if (isLazadaUrl(url)) return crawlLazadaShop(url);

  // Try Shopify first — it's the most common storefront platform after
  // marketplaces. The `/products.json` endpoint is reliable + universal.
  const shopifyResult = await tryShopify(url);
  if (shopifyResult) return shopifyResult;

  // Fallback: AI-extract product listings from the shop HTML.
  return crawlGenericWithAi(url);
}

// ─── Shopify ────────────────────────────────────────────────────────────

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  vendor?: string;
  variants?: Array<{
    price?: string;
    compare_at_price?: string | null;
    inventory_quantity?: number;
  }>;
  images?: Array<{ src: string }>;
}

async function tryShopify(shopUrl: string): Promise<ShopCrawlResult | null> {
  try {
    const base = new URL(shopUrl);
    base.pathname = "/products.json";
    base.search = "?limit=250";
    const res = await fetch(base.toString(), {
      headers: { ...REAL_CHROME_HEADERS, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !Array.isArray(json.products)) return null;
    const items = json.products as ShopifyProduct[];

    const products: ImportedProduct[] = items.slice(0, MAX_PRODUCTS).map((it) => {
      const v = it.variants?.[0];
      const priceSatang = Math.round(Number.parseFloat(v?.price ?? "0") * 100) || 0;
      const compareAt = v?.compare_at_price
        ? Math.round(Number.parseFloat(v.compare_at_price) * 100)
        : null;
      const stock = typeof v?.inventory_quantity === "number" ? v.inventory_quantity : null;
      const images = (it.images ?? []).map((i) => i.src).filter((s) => s.startsWith("http"));
      const description = (it.body_html ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const warnings: string[] = [];
      if (priceSatang === 0) warnings.push("ราคา 0 — ตรวจสอบหน้าร้าน Shopify");
      const productUrl = new URL(`/products/${it.handle}`, base).toString();
      return {
        tempId: tempIdFor(`shopify-${it.id}`),
        name: it.title.trim(),
        description: description || null,
        priceSatang,
        compareAtSatang: compareAt && compareAt > priceSatang ? compareAt : null,
        shippingFeeSatang: 0,
        imageUrls: images,
        stock,
        type: "PHYSICAL",
        source: "url-jsonld",
        sourceUrl: productUrl,
        warnings,
      };
    });

    return {
      products,
      failures: [],
      platform: "shopify",
      totalDetected: items.length,
    };
  } catch {
    return null;
  }
}

// ─── Lazada shop page ──────────────────────────────────────────────────

async function crawlLazadaShop(shopUrl: string): Promise<ShopCrawlResult> {
  const productUrls = new Set<string>();
  const MAX_PAGES = 5;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const u = new URL(shopUrl);
    u.searchParams.set("page", String(page));
    const res = await fetch(u.toString(), {
      headers: REAL_CHROME_HEADERS,
      cache: "no-store",
    });
    if (!res.ok) break;
    const html = await res.text();
    // Lazada listing pages embed product links as `/products/{slug}-i{id}-s{sku}.html`.
    const matches = html.matchAll(/\/products\/[^"'<>?]+-i\d+-s\d+\.html/g);
    let foundOnPage = 0;
    for (const m of matches) {
      const fullUrl = new URL(m[0], "https://www.lazada.co.th").toString();
      if (!productUrls.has(fullUrl)) {
        productUrls.add(fullUrl);
        foundOnPage++;
        if (productUrls.size >= MAX_PRODUCTS) break;
      }
    }
    if (foundOnPage === 0 || productUrls.size >= MAX_PRODUCTS) break;
  }

  return fetchEachProduct([...productUrls], fetchLazadaProduct, "lazada");
}

// ─── Generic AI-driven extraction ──────────────────────────────────────

interface AiExtractedProduct {
  name: string;
  priceTHB: number | null;
  imageUrl: string | null;
  productUrl: string | null;
}

/**
 * The HTML can be 200-500 KB; we strip everything that isn't the product
 * listing area before sending to Claude. This both lowers token cost and
 * makes the model's job easier.
 */
function compactHtmlForAi(html: string): string {
  const $ = cheerio.load(html);
  $("script,style,noscript,link,meta,svg,iframe,header,footer,nav,form").remove();
  // Keep only the body innerHTML, collapse whitespace.
  return $("body").html()?.replace(/\s+/g, " ").trim().slice(0, 60_000) ?? "";
}

async function crawlGenericWithAi(shopUrl: string): Promise<ShopCrawlResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ระบบ AI ยังไม่ได้ตั้งค่า — กรุณาวางลิงก์สินค้าแต่ละชิ้นที่แท็บก่อนหน้าแทน");
  }

  const res = await fetch(shopUrl, {
    headers: REAL_CHROME_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`เว็บเป้าหมายตอบกลับ ${res.status} — อาจเป็นเว็บที่ป้องกัน bot`);
  }
  const html = await res.text();
  const compact = compactHtmlForAi(html);
  if (compact.length < 100) {
    throw new Error("HTML จากหน้าร้านสั้นเกินไป — อาจเป็น single-page app ที่ต้องเรียกข้อมูลผ่าน JS");
  }

  const client = new Anthropic({ apiKey });
  const sys =
    "You extract product listings from raw HTML. Return JSON ONLY, no prose. " +
    'Schema: { "products": [{ "name": string, "priceTHB": number|null, "imageUrl": string|null, "productUrl": string|null }] }. ' +
    "Only include items that look like real products for sale (have a name AND either a price or a product page link). " +
    "Skip nav links, banners, related articles, social posts. Return at most " +
    MAX_PRODUCTS +
    " items. Absolute URLs only.";

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: sys,
    messages: [
      {
        role: "user",
        content: `Shop URL: ${shopUrl}\n\nHTML:\n${compact}`,
      },
    ],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("AI ไม่ตอบกลับ — ลองใหม่อีกครั้ง");
  }
  const raw = block.text.trim();
  // Some models wrap JSON in ``` fences; strip them
  const jsonText = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  let parsed: { products?: AiExtractedProduct[] };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("AI ส่งข้อมูลที่อ่านไม่ได้กลับมา — กรุณาลองใหม่");
  }
  const extracted = Array.isArray(parsed.products) ? parsed.products : [];

  // If AI returned product page URLs, enrich each by running the generic
  // JSON-LD extractor (in parallel, capped). Otherwise we just use what
  // AI gave us directly.
  const enrichable = extracted.filter(
    (p): p is AiExtractedProduct & { productUrl: string } =>
      Boolean(p.productUrl && /^https?:\/\//i.test(p.productUrl)),
  );

  if (enrichable.length > 0) {
    const productUrls = enrichable.map((p) => p.productUrl);
    const enriched = await fetchEachProduct(productUrls, fetchJsonLdProduct, "ai-extracted");
    if (enriched.products.length > 0) {
      return {
        ...enriched,
        totalDetected: extracted.length,
      };
    }
  }

  // Fallback: trust the AI's parse.
  const products: ImportedProduct[] = extracted.map((p, i) => {
    const priceSatang = p.priceTHB ? Math.round(p.priceTHB * 100) : 0;
    return {
      tempId: tempIdFor(`ai-${i}-${p.name}`),
      name: p.name.trim() || `Untitled ${i + 1}`,
      description: null,
      priceSatang,
      compareAtSatang: null,
      shippingFeeSatang: 0,
      imageUrls: p.imageUrl ? [p.imageUrl] : [],
      stock: null,
      type: "PHYSICAL",
      source: "url-jsonld",
      sourceUrl: p.productUrl,
      warnings: priceSatang === 0 ? ["ราคา 0 — AI ไม่พบราคา"] : [],
    };
  });

  return {
    products,
    failures: [],
    platform: "ai-extracted",
    totalDetected: extracted.length,
  };
}

// ─── Shared sliding-window product fetcher ──────────────────────────────

async function fetchEachProduct(
  urls: string[],
  fetcher: (u: string) => Promise<ImportedProduct>,
  platform: ShopCrawlResult["platform"],
  concurrency = 3,
): Promise<ShopCrawlResult> {
  const products: ImportedProduct[] = [];
  const failures: ShopCrawlResult["failures"] = [];
  let cursor = 0;
  const trimmed = urls.slice(0, MAX_PRODUCTS);
  const workers = Array.from({ length: Math.min(concurrency, trimmed.length) }, async () => {
    while (cursor < trimmed.length) {
      const i = cursor++;
      const u = trimmed[i]!;
      try {
        products.push(await fetcher(u));
      } catch (e) {
        failures.push({
          url: u,
          reason: e instanceof Error ? e.message : "ดึงไม่สำเร็จ",
        });
      }
    }
  });
  await Promise.all(workers);
  return { products, failures, platform, totalDetected: urls.length };
}
