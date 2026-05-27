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
    const res = await fetch(sourceUrl, {
      headers: REAL_CHROME_HEADERS,
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
  opts: { concurrency?: number } = {},
): Promise<string[]> {
  if (!urls.length) return [];
  const concurrency = opts.concurrency ?? 4;
  const out: (string | null)[] = new Array(urls.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (cursor < urls.length) {
      const i = cursor++;
      out[i] = await rehostImage(urls[i]!, shopId);
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
