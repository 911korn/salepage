/**
 * Helpers shared across importers.
 */
import { createHash } from "node:crypto";

/**
 * Stable hash-based id for the preview UI. Lets us round-trip back to the
 * server during commit without exposing the source identifier.
 */
export function tempIdFor(seed: string): string {
  return createHash("sha1").update(seed).digest("hex").slice(0, 12);
}

/**
 * Slugify a product name to URL-safe ASCII (a-z, 0-9, `-`), matching the
 * manual-create route. Thai-only names come back "" and the caller falls
 * back to `product-<id>`.
 *
 * Thai was allowed here until 2026-10-29: product pages are ISR, and
 * Next 16.2 puts the decoded pathname into the `x-next-cache-tags` response
 * header, which throws on non-ASCII — every imported Thai-slug product page
 * returned 500. (The earlier \p{Mark} fix stopped mangled Thai; this stops
 * Thai slugs entirely.)
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Parse a price string into satang. Handles "฿", "$", "THB", commas,
 * decimals, "1,200.50" → 120050. Returns 0 if unparseable.
 */
export function priceToSatang(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[฿$,\s]/g, "").replace(/THB/i, "");
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function parseStock(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value !== "string") return null;
  const num = Number.parseInt(value.replace(/[,\s]/g, ""), 10);
  return Number.isFinite(num) ? Math.max(0, num) : null;
}

/**
 * Split a comma/semicolon/newline separated string of URLs. Some Shopee
 * exports glob image URLs together with `|`.
 */
export function splitImageUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((v) => (typeof v === "string" ? [v] : []));
  }
  if (typeof value !== "string") return [];
  return value
    .split(/[\n,;|]+/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("http"));
}
