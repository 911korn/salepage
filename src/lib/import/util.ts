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
 * Slugify a product name to URL-safe ASCII + Thai. Lowercase, spaces and
 * symbols become `-`. Preserves Thai characters as-is — the storefront URL
 * spec keeps them URL-encoded for SEO.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}\-]/gu, "")
    .replace(/-{2,}/g, "-")
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
