/**
 * ASCII alias for product slugs that contain non-ASCII (Thai) characters.
 *
 * Product pages are ISR, and Next 16.2 writes the decoded pathname into the
 * `x-next-cache-tags` response header — a Thai path makes that header
 * invalid and the page 500s. proxy.ts rewrites such requests to
 * `/<locale>/s/<shop>/_u_<base64url(slug)>` (the browser keeps the Thai URL)
 * and the product loader decodes the alias back to the real slug, so live
 * Thai slugs keep working without re-slugging (re-slugging breaks links).
 *
 * Edge-safe: TextEncoder/btoa only, no Buffer.
 */

const PREFIX = "_u_";

export function hasNonAscii(value: string): boolean {
  return /[^\x00-\x7F]/.test(value);
}

export function encodeProductSlugAlias(slug: string): string {
  const bytes = new TextEncoder().encode(slug);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return (
    PREFIX +
    btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  );
}

/** Returns the real slug for an alias, or the input unchanged. Real slugs
 *  never start with `_` (both slugify paths emit [a-z0-9-] only). */
export function decodeProductSlugParam(param: string): string {
  if (!param.startsWith(PREFIX)) return param;
  try {
    const b64 = param.slice(PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return param;
  }
}
