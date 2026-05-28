import "server-only";

/**
 * Porkbun API wrappers — domain pricing + availability search.
 * Porkbun's public API doesn't expose a "register" endpoint, so we combine:
 *
 *   1. RDAP for availability (IANA-standard WHOIS replacement, public, free)
 *   2. Porkbun `/pricing/get` for live TLD pricing
 *
 * Sellers see "Domain available · $X.XX/year" + a deep link to Porkbun
 * checkout. After purchase they come back to /dashboard/settings/domains
 * and the existing CF-zone flow takes over (NS delegation onboards them).
 *
 * Pattern ported from /siteblox.ai/lib/porkbun.ts — 911korn already
 * validated this approach on Siteblox. 911korn 2026-05-28 "ทำซื้อ
 * Domain ไปด้วยเลย".
 *
 * Future: swap deep-link for OpenSRS/Name.com reseller API + Stripe
 * checkout to close the loop without leaving the dashboard.
 */

const PB_API = "https://api.porkbun.com/api/json/v3";

export function isPorkbunConfigured(): boolean {
  return !!process.env.PORKBUN_API_KEY && !!process.env.PORKBUN_SECRET_KEY;
}

function authBody(): { apikey: string; secretapikey: string } {
  const apikey = process.env.PORKBUN_API_KEY;
  const secretapikey = process.env.PORKBUN_SECRET_KEY;
  if (!apikey || !secretapikey) {
    throw new Error("Porkbun credentials not set.");
  }
  return { apikey, secretapikey };
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

interface PorkbunPricingResult {
  status: "SUCCESS" | "ERROR";
  pricing?: Record<
    string,
    {
      registration: string;
      renewal: string;
      transfer: string;
    }
  >;
  message?: string;
}

export interface TldPrice {
  tld: string;
  registrationUsd: number;
  renewalUsd: number;
  transferUsd: number;
}

let _pricingCache: {
  fetchedAt: number;
  data: Map<string, TldPrice>;
} | null = null;
const PRICING_TTL_MS = 6 * 60 * 60 * 1000; // 6h

/**
 * Fetch the full TLD pricing catalogue from Porkbun. Cached in-memory for
 * 6 hours because the list is large (500+ TLDs) and rarely changes.
 */
export async function getPricing(): Promise<Map<string, TldPrice>> {
  if (
    _pricingCache &&
    Date.now() - _pricingCache.fetchedAt < PRICING_TTL_MS
  ) {
    return _pricingCache.data;
  }

  const res = await fetch(`${PB_API}/pricing/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(authBody()),
  });

  const body = (await res.json()) as PorkbunPricingResult;
  if (body.status !== "SUCCESS" || !body.pricing) {
    throw new Error(body.message || "Porkbun pricing fetch failed.");
  }

  const data = new Map<string, TldPrice>();
  for (const [tld, p] of Object.entries(body.pricing)) {
    data.set(tld.toLowerCase(), {
      tld: tld.toLowerCase(),
      registrationUsd: Number(p.registration),
      renewalUsd: Number(p.renewal),
      transferUsd: Number(p.transfer),
    });
  }

  _pricingCache = { fetchedAt: Date.now(), data };
  return data;
}

export async function priceFor(tld: string): Promise<TldPrice | null> {
  const map = await getPricing();
  return map.get(tld.toLowerCase()) ?? null;
}

// ---------------------------------------------------------------------------
// Availability via RDAP (public, no auth, works for every TLD)
// ---------------------------------------------------------------------------

/**
 * Check if a domain is available for registration using IANA's RDAP
 * protocol. Every TLD registry runs an RDAP endpoint; IANA's bootstrap
 * service tells us which one.
 *
 * Returns true if the domain is NOT registered (i.e. available).
 */
export async function isAvailable(domain: string): Promise<boolean> {
  const clean = domain.trim().toLowerCase().replace(/\/.*$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(clean)) {
    throw new Error("Invalid domain.");
  }

  // IANA bootstrap tells us the RDAP base for this TLD.
  const tld = clean.split(".").slice(-1)[0];
  const rdapBase = await rdapBaseFor(tld);
  if (!rdapBase) {
    throw new Error(`No RDAP server known for .${tld}`);
  }

  const res = await fetch(`${rdapBase}domain/${clean}`, {
    headers: { Accept: "application/rdap+json" },
  });
  if (res.status === 404) return true;
  if (res.ok) return false;
  // Some servers return 400/403 when rate-limited; surface rather than
  // silently lying about availability.
  throw new Error(`RDAP lookup failed (HTTP ${res.status})`);
}

let _rdapBootstrapCache: {
  fetchedAt: number;
  // tld -> first RDAP base URL (ends with "/")
  map: Map<string, string>;
} | null = null;
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function rdapBaseFor(tld: string): Promise<string | null> {
  if (
    !_rdapBootstrapCache ||
    Date.now() - _rdapBootstrapCache.fetchedAt > BOOTSTRAP_TTL_MS
  ) {
    const res = await fetch("https://data.iana.org/rdap/dns.json");
    if (!res.ok) throw new Error("IANA RDAP bootstrap fetch failed.");
    const body = (await res.json()) as {
      services: Array<[string[], string[]]>;
    };
    const map = new Map<string, string>();
    for (const [tlds, bases] of body.services) {
      for (const t of tlds) {
        if (bases[0]) {
          const base = bases[0].endsWith("/") ? bases[0] : bases[0] + "/";
          map.set(t.toLowerCase(), base);
        }
      }
    }
    _rdapBootstrapCache = { fetchedAt: Date.now(), map };
  }
  return _rdapBootstrapCache.map.get(tld.toLowerCase()) ?? null;
}

// ---------------------------------------------------------------------------
// Buy link — deep-link into Porkbun's checkout so the user completes the
// actual registration in Porkbun's UI. Until they publish a register API
// we surface a very smooth hand-off rather than juggle a second registrar.
// ---------------------------------------------------------------------------

export function buyUrl(domain: string): string {
  const clean = domain.trim().toLowerCase().replace(/\/.*$/, "");
  // Porkbun's search URL pre-populates the query. After sign-up, the domain
  // lands in their account immediately and they can delegate NS to us via
  // Porkbun's dashboard → we then pick it up in our managed-DNS flow.
  return `https://porkbun.com/checkout/search?q=${encodeURIComponent(clean)}`;
}
