import "server-only";
import { put } from "@vercel/blob";
import { REAL_CHROME_HEADERS } from "./headers";

/**
 * Download a Shopee/Lazada/JSON-LD image and push it to Vercel Blob.
 *
 * Why re-host vs hot-linking:
 * - Shopee/Lazada CDNs can change URLs or hot-link block at any time.
 * - Singapore Blob ↔ Singapore database ↔ Singapore buyers = fast.
 * - Avoids leaking our seller's catalogue back to a competitor's CDN logs.
 *
 * Caller batches these — runs in parallel with a concurrency cap so a
 * 50-image import doesn't bottleneck on one slow CDN.
 */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB — same cap as slip uploads

export async function rehostImage(
  sourceUrl: string,
  shopId: string,
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return sourceUrl;
  try {
    // Build the request with both Chrome UA AND a same-origin Referer —
    // some CDNs (Shopify, Lazada Asia CDN) hot-link-block requests that
    // come in without a Referer matching the image's own origin.
    const origin = (() => {
      try {
        return new URL(sourceUrl).origin;
      } catch {
        return null;
      }
    })();
    const res = await fetch(sourceUrl, {
      headers: {
        ...REAL_CHROME_HEADERS,
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        ...(origin ? { Referer: origin + "/" } : {}),
      },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;

    const { contentType, extension } = sniffImageType(buf);
    const key = `shops/${shopId}/imports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const stored = await put(key, buf, {
      access: "public",
      addRandomSuffix: false,
      contentType,
    });
    return stored.url;
  } catch {
    return null;
  }
}

export async function rehostImages(
  urls: string[],
  shopId: string,
  opts: { concurrency?: number; fallbackToSource?: boolean } = {},
): Promise<string[]> {
  if (!urls.length) return [];
  const concurrency = opts.concurrency ?? 4;
  // Default: keep the original source URL when rehost fails. Hot-linking
  // to Shopee/Lazada CDN isn't ideal long-term (they can break it later)
  // but it's vastly better than saving the product with no images at all.
  // 911korn 2026-05-28 spotted /loopwear with 11/12 products imageUrls:[]
  // because Shopify image CDN 403'd our Vercel SIN1 IPs. From now on the
  // product at least renders WITH source images while ops backfills via
  // a retry cron. Caller can opt out for cases where hot-linking is
  // disallowed by setting fallbackToSource: false.
  const fallback = opts.fallbackToSource !== false;
  const out: (string | null)[] = new Array(urls.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (cursor < urls.length) {
      const i = cursor++;
      const sourceUrl = urls[i]!;
      const rehosted = await rehostImage(sourceUrl, shopId);
      out[i] = rehosted ?? (fallback ? sourceUrl : null);
    }
  });
  await Promise.all(workers);
  return out.filter((u): u is string => Boolean(u));
}

function sniffImageType(bytes: Buffer): { contentType: string; extension: string } {
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return { contentType: "image/png", extension: "png" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return { contentType: "image/jpeg", extension: "jpg" };
}
