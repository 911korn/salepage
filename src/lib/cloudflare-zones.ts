import "server-only";

/**
 * Cloudflare Zones API client for the custom-domain feature.
 *
 * Seller flow:
 *   1. Seller types `mystore.com` in dashboard
 *   2. We call createZone() → CF returns NS1/NS2 (ns.cloudflare.com pair)
 *   3. Seller pastes those at their registrar
 *   4. We call attachVercelRecords() so once DNS propagates the apex + www
 *      point at Vercel (76.76.21.21 / cname.vercel-dns.com)
 *   5. Periodic verify polls CF for zone.status === "active"
 *   6. Middleware in this project reads request Host → resolves to a shop
 *      slug → rewrites URL so /s/{slug}/* renders under the custom domain
 *
 * Pattern ported from /Users/macbook/Desktop/project/siteblox.ai/lib/cloudflare.ts —
 * same approach 911korn validated for SiteBlox is reused here for SalePage
 * shops. CF Universal SSL auto-provisions per zone — no extra work.
 *
 * 911korn 2026-05-28 "ทำแบบ Siteblox".
 */

const CF_API = "https://api.cloudflare.com/client/v4";

function authHeaders(): Record<string, string> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is not set — custom-domain feature is disabled.",
    );
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export function isCloudflareConfigured(): boolean {
  return (
    !!process.env.CLOUDFLARE_API_TOKEN && !!process.env.CLOUDFLARE_ACCOUNT_ID
  );
}

export type CfZoneStatus =
  | "initializing"
  | "pending"
  | "active"
  | "moved"
  | "deactivated"
  | "deleted"
  | "read only";

export interface CfZone {
  id: string;
  name: string;
  status: CfZoneStatus;
  /** Nameservers Cloudflare assigned — seller must paste these at registrar. */
  nameservers: string[];
}

interface CfResult<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: unknown[];
  result: T;
}

async function cf<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | undefined> },
): Promise<T> {
  const url = new URL(`${CF_API}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as object) },
  });
  const body = (await res.json()) as CfResult<T>;
  if (!res.ok || !body.success) {
    const msg =
      body.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") ||
      `HTTP ${res.status}`;
    throw new Error(`Cloudflare API — ${msg}`);
  }
  return body.result;
}

interface RawZone {
  id: string;
  name: string;
  status: CfZoneStatus;
  name_servers?: string[];
}

function normaliseZone(raw: RawZone): CfZone {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    nameservers: raw.name_servers ?? [],
  };
}

/** Create a new zone on our CF account. The caller must persist the
 *  returned id + nameservers and surface the nameservers to the seller. */
export async function createZone(domain: string): Promise<CfZone> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID not set");
  const raw = await cf<RawZone>(`/zones`, {
    method: "POST",
    body: JSON.stringify({
      name: domain,
      account: { id: accountId },
      type: "full",
    }),
  });
  return normaliseZone(raw);
}

export async function getZone(zoneId: string): Promise<CfZone> {
  const raw = await cf<RawZone>(`/zones/${zoneId}`);
  return normaliseZone(raw);
}

export async function findZoneByName(domain: string): Promise<CfZone | null> {
  const body = await cf<RawZone[]>("/zones", {
    query: { name: domain, per_page: "1" },
  });
  return body.length > 0 ? normaliseZone(body[0]) : null;
}

/** Ask CF to re-check the zone's nameservers. Seller clicks "Verify"
 *  after pasting NS at their registrar; CF flips from "pending" → "active". */
export async function verifyZone(zoneId: string): Promise<CfZone> {
  await cf(`/zones/${zoneId}/activation_check`, { method: "PUT" });
  return getZone(zoneId);
}

export async function deleteZone(zoneId: string): Promise<void> {
  await cf(`/zones/${zoneId}`, { method: "DELETE" });
}

interface CfRecord {
  id: string;
  type: string;
  name: string;
  content: string;
}

interface CfRecordInput {
  type: "A" | "CNAME";
  name: string;
  content: string;
  proxied?: boolean;
}

async function listRecords(zoneId: string): Promise<CfRecord[]> {
  return cf<CfRecord[]>(`/zones/${zoneId}/dns_records`, {
    query: { per_page: "100" },
  });
}

async function createRecord(zoneId: string, input: CfRecordInput) {
  return cf<CfRecord>(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({
      type: input.type,
      name: input.name,
      content: input.content,
      ttl: 1,
      proxied: input.proxied ?? true, // proxy through CF for DDoS + cache
    }),
  });
}

async function deleteRecord(zoneId: string, recordId: string): Promise<void> {
  await cf(`/zones/${zoneId}/dns_records/${recordId}`, { method: "DELETE" });
}

async function upsertRecord(
  zoneId: string,
  input: CfRecordInput,
): Promise<void> {
  const existing = await listRecords(zoneId);
  const match = existing.find(
    (r) => r.type === input.type && r.name === input.name,
  );
  if (match && match.content === input.content) return;
  if (match) await deleteRecord(zoneId, match.id);
  await createRecord(zoneId, input);
}

/** Wire a freshly-created zone to point at our Vercel deployment.
 *  Creates `A @ → 76.76.21.21` (Vercel anycast IP for apex) +
 *  `CNAME www → cname.vercel-dns.com`. Safe to call repeatedly —
 *  unchanged records are preserved.
 *
 *  PROXY DISABLED (gray cloud) in Phase 1 so Vercel can issue its
 *  own Let's Encrypt cert via HTTP-01 challenge without CF stepping
 *  in. Phase 2 will flip to proxied=true after the Vercel cert
 *  is active, so the seller gets CF's DDoS protection + edge cache
 *  on top. */
export async function attachVercelRecords(
  zoneId: string,
  apexDomain: string,
): Promise<void> {
  await upsertRecord(zoneId, {
    type: "A",
    name: apexDomain,
    content: "76.76.21.21",
    proxied: false,
  });
  await upsertRecord(zoneId, {
    type: "CNAME",
    name: `www.${apexDomain}`,
    content: "cname.vercel-dns.com",
    proxied: false,
  });
}
