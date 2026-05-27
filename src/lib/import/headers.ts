/**
 * Facebook crawler User-Agent — the magic key that unlocks Shopee /
 * Lazada / TikTok Shop / Amazon static metadata.
 *
 * Why this works (lifted from LinkAF's playbook 2026-05-28): every
 * marketplace whitelists social-platform crawler UAs because their own
 * users share product links inside Facebook / WhatsApp / Telegram and
 * the link previews need to render. The whitelist serves the full OG
 * metadata page (image, title, description, price meta tags) to these
 * UAs without the anti-bot interstitial. Generic Chrome UA = blocked;
 * Facebook crawler UA = whitelisted.
 *
 * Trade-off: pages served to crawlers are the static SSR shell — any
 * data that requires JS hydration (Shopee dynamic prices, Lazada
 * variant pickers, TikTok Shop live inventory) is still missing. For
 * those we fall back to Chrome UA / Puppeteer / AI extraction.
 */
export const FACEBOOK_CRAWLER_HEADERS = {
  "User-Agent":
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
};

/**
 * Realistic Chrome 130 (macOS) headers — fallback when the Facebook
 * crawler UA returns degraded preview content. Keep in sync when
 * Chrome's UA bumps versions.
 */
export const REAL_CHROME_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
  "Sec-Ch-Ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

/**
 * Layered-fetch helper: tries Facebook crawler UA first, falls back to
 * real Chrome UA if the result looks empty/blocked. Returns whichever
 * response yielded content.
 */
export async function layeredFetch(
  url: string,
  opts: { extraHeaders?: Record<string, string> } = {},
): Promise<{ html: string; status: number; via: "fb" | "chrome" }> {
  // Layer 1: Facebook crawler UA — the unlock key for SE Asian marketplaces.
  try {
    const res = await fetch(url, {
      headers: { ...FACEBOOK_CRAWLER_HEADERS, ...(opts.extraHeaders ?? {}) },
      cache: "no-store",
      redirect: "follow",
    });
    const html = await res.text();
    // 200 + reasonably-sized HTML body = good enough. Pages that 403 the
    // FB UA are rare; pages that return a tiny shell (<5KB) likely need
    // the Chrome UA fallback.
    if (res.ok && html.length >= 5_000) {
      return { html, status: res.status, via: "fb" };
    }
  } catch {
    // Fall through to Chrome UA.
  }
  // Layer 2: Real Chrome UA.
  const res = await fetch(url, {
    headers: { ...REAL_CHROME_HEADERS, ...(opts.extraHeaders ?? {}) },
    cache: "no-store",
    redirect: "follow",
  });
  const html = await res.text();
  return { html, status: res.status, via: "chrome" };
}

/**
 * Variant for Shopee's mobile-web JSON API. Shopee specifically checks
 * `X-API-SOURCE: pc` + a few language headers before serving the
 * `/api/v4/item/get` payload. Without them the response is HTML.
 */
export const SHOPEE_API_HEADERS = {
  ...REAL_CHROME_HEADERS,
  "Accept": "application/json, text/plain, */*",
  "X-API-SOURCE": "pc",
  "X-Requested-With": "XMLHttpRequest",
  "X-Shopee-Language": "th",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};
