import { SHOPEE_API_HEADERS } from "./headers";
import type { ImportedProduct } from "./types";
import { tempIdFor } from "./util";

/**
 * Parses Shopee URLs and pulls product data via the public mobile-web API.
 *
 * Supported URL shapes (Shopee TH):
 *   https://shopee.co.th/{name}-i.{shopId}.{itemId}
 *   https://shopee.co.th/product/{shopId}/{itemId}
 *   https://shopee.co.th/{name}-i.{shopId}.{itemId}?...
 *
 * Shopee's `/api/v4/item/get` returns the full product JSON. Image URLs
 * come back as bare hashes — we prefix `https://cf.shopee.co.th/file/`
 * which is their CDN (image-only, no auth, hot-link-safe).
 */
export function isShopeeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith("shopee.co.th") || u.hostname.endsWith("shopee.com");
  } catch {
    return false;
  }
}

interface ShopeeIds {
  shopId: number;
  itemId: number;
}

export function parseShopeeIds(url: string): ShopeeIds | null {
  try {
    const u = new URL(url);
    const path = u.pathname;
    // Shape 1: /{name}-i.{shopId}.{itemId}
    const m1 = path.match(/-i\.(\d+)\.(\d+)/);
    if (m1) return { shopId: Number(m1[1]), itemId: Number(m1[2]) };
    // Shape 2: /product/{shopId}/{itemId}
    const m2 = path.match(/\/product\/(\d+)\/(\d+)/);
    if (m2) return { shopId: Number(m2[1]), itemId: Number(m2[2]) };
    return null;
  } catch {
    return null;
  }
}

interface ShopeeItem {
  itemid: number;
  shopid: number;
  name: string;
  description: string;
  // Price is in 100000ths — Shopee multiplies THB by 100000 for some reason.
  // Convert to satang: price / 1000.
  price: number;
  price_min?: number;
  price_max?: number;
  price_before_discount?: number;
  stock: number;
  image: string;
  images: string[];
  status: number;
}

function shopeeImageUrl(hash: string): string {
  if (!hash) return "";
  if (hash.startsWith("http://") || hash.startsWith("https://")) return hash;
  return `https://cf.shopee.co.th/file/${hash}`;
}

/**
 * Convert Shopee's 100000ths-of-THB to satang.
 *   1 THB = 100 satang
 *   shopeePrice / 100000 = THB → * 100 = satang → /1000
 */
function shopeePriceToSatang(p: number | undefined): number {
  if (!p || !Number.isFinite(p) || p <= 0) return 0;
  return Math.round(p / 1000);
}

/**
 * Friendly error pointing the seller to the CSV path. We throw this
 * verbatim so the dashboard's URL-failure list shows the same actionable
 * message every time. Shopee's anti-bot is aggressive enough that we
 * can't reliably scrape from a server (CSRF tokens are signed by
 * obfuscated client-side JS) — the CSV import is the supported route.
 */
const SHOPEE_BLOCKED_MESSAGE =
  "Shopee ป้องกัน import อัตโนมัติ · กรุณาใช้ไฟล์ Excel จาก Shopee Seller Center → " +
  '"คลังสินค้าของฉัน" → "ส่งออกจำนวนมาก" แล้วอัปโหลดที่แท็บ "CSV/XLSX" ด้านบนแทน';

export async function fetchShopeeProduct(url: string): Promise<ImportedProduct> {
  const ids = parseShopeeIds(url);
  if (!ids) throw new Error("ลิงก์ Shopee นี้อ่าน itemId/shopId ไม่ได้ — ลองคัดลอกลิงก์สินค้าจากหน้า Shopee ใหม่อีกครั้ง");

  // Cookie warm-up — visit the homepage first so Shopee's edge sees a
  // browser-shaped session before we hit the API. Helps in ~30% of cases;
  // most still get 403 because the CSRF token is required.
  try {
    await fetch("https://shopee.co.th/", {
      headers: SHOPEE_API_HEADERS,
      cache: "no-store",
    });
  } catch {
    // ignore — best effort
  }

  const apiUrl = `https://shopee.co.th/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`;
  let res: Response;
  try {
    res = await fetch(apiUrl, {
      headers: {
        ...SHOPEE_API_HEADERS,
        Referer: `https://shopee.co.th/-i.${ids.shopId}.${ids.itemId}`,
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(SHOPEE_BLOCKED_MESSAGE);
  }

  if (!res.ok) {
    throw new Error(SHOPEE_BLOCKED_MESSAGE);
  }

  const text = await res.text();
  if (!text || text.trim().startsWith("<")) {
    throw new Error(SHOPEE_BLOCKED_MESSAGE);
  }

  let payload: { data?: ShopeeItem; error?: number; error_msg?: string };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(SHOPEE_BLOCKED_MESSAGE);
  }

  const item = payload.data;
  if (!item || payload.error) {
    throw new Error(
      payload.error_msg || "ไม่พบสินค้านี้ใน Shopee — อาจถูกซ่อนหรือลบไปแล้ว",
    );
  }

  const priceSatang = shopeePriceToSatang(item.price ?? item.price_min);
  const compareAtSatang =
    item.price_before_discount && item.price_before_discount > (item.price ?? 0)
      ? shopeePriceToSatang(item.price_before_discount)
      : null;

  const imageUrls: string[] = [];
  if (item.image) imageUrls.push(shopeeImageUrl(item.image));
  for (const i of item.images || []) {
    const u = shopeeImageUrl(i);
    if (u && !imageUrls.includes(u)) imageUrls.push(u);
  }

  const warnings: string[] = [];
  if (priceSatang === 0) warnings.push("ราคา 0 — ตรวจสอบที่ Shopee ว่าเป็นสินค้าที่กำหนดราคาแบบช่วงหรือไม่");
  if (imageUrls.length === 0) warnings.push("ไม่พบรูปสินค้า");

  return {
    tempId: tempIdFor(`shopee-${ids.itemId}`),
    name: (item.name || "").trim() || `Shopee Item ${ids.itemId}`,
    description: (item.description || "").trim() || null,
    priceSatang,
    compareAtSatang,
    shippingFeeSatang: 0,
    imageUrls,
    stock: typeof item.stock === "number" ? item.stock : null,
    type: "PHYSICAL",
    source: "url-shopee",
    sourceUrl: url,
    warnings,
  };
}
