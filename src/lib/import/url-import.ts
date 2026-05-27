import { fetchJsonLdProduct } from "./jsonld";
import { fetchLazadaProduct, isLazadaUrl } from "./lazada";
import { fetchShopeeProduct, isShopeeUrl } from "./shopee";
import type { ImportedProduct } from "./types";

/**
 * Single entry point — picks the right extractor for a given URL.
 * Order matters: platform-specific extractors first (Shopee/Lazada), then
 * the generic JSON-LD fallback that handles TikTok Shop / Shopify / etc.
 */
export async function fetchProductFromUrl(url: string): Promise<ImportedProduct> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://");
  }
  if (isShopeeUrl(trimmed)) return fetchShopeeProduct(trimmed);
  if (isLazadaUrl(trimmed)) return fetchLazadaProduct(trimmed);
  return fetchJsonLdProduct(trimmed);
}

/**
 * Batch fetcher used by the dashboard endpoint. Runs imports in parallel
 * with a small concurrency cap so we don't hammer any one platform and
 * trip rate-limits. Returns successes + failures separately so the UI can
 * surface partial results.
 */
export interface BatchResult {
  successes: ImportedProduct[];
  failures: { url: string; reason: string }[];
}

export async function fetchProductsFromUrls(
  urls: string[],
  opts: { concurrency?: number } = {},
): Promise<BatchResult> {
  const concurrency = opts.concurrency ?? 3;
  const successes: ImportedProduct[] = [];
  const failures: { url: string; reason: string }[] = [];

  // Simple sliding window — keep `concurrency` requests in flight, dispatch
  // the next one as each completes. We don't need fancy throttling because
  // the dashboard caps the URL count well below where rate-limits bite.
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (cursor < urls.length) {
      const i = cursor++;
      const u = urls[i]!;
      try {
        const p = await fetchProductFromUrl(u);
        successes.push(p);
      } catch (e) {
        failures.push({
          url: u,
          reason: e instanceof Error ? e.message : "ดึงข้อมูลล้มเหลว",
        });
      }
    }
  });
  await Promise.all(workers);
  return { successes, failures };
}
