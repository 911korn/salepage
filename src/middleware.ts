import { NextResponse, type NextRequest } from "next/server";

/**
 * Custom-domain middleware — runs at the edge on every page request.
 *
 * Job:
 *   - Detect requests coming in via a seller's custom domain
 *     (anything that isn't salepage.in.th, vercel.app, localhost)
 *   - Resolve host → shop slug via `/api/v1/internal/resolve-domain`
 *   - Rewrite the URL so the existing `/s/[slug]/*` route renders
 *
 * Caching:
 *   - In-memory Map per edge runtime instance, 5-min TTL — avoids hitting
 *     the internal API on every request from the same hot host
 *   - Failed lookups cached for 30s so we don't hammer DB for typos
 *
 * 911korn 2026-05-28 "ทำแบบ Siteblox" — same pattern, simpler scope
 * because all shops live under one root route.
 */

const PRIMARY_HOSTS = new Set([
  "salepage.in.th",
  "www.salepage.in.th",
]);

const CACHE = new Map<string, { slug: string | null; expiresAt: number }>();
const TTL_OK_MS = 5 * 60 * 1000;
const TTL_MISS_MS = 30 * 1000;

async function resolveHost(host: string, origin: string): Promise<string | null> {
  const cached = CACHE.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.slug;
  }
  try {
    const res = await fetch(
      `${origin}/api/v1/internal/resolve-domain?host=${encodeURIComponent(host)}`,
      {
        headers: {
          "x-internal-secret": process.env.INTERNAL_RESOLVE_SECRET ?? "",
        },
        // Avoid Next's automatic cache so middleware respects DB updates
        // within the TTL window.
        cache: "no-store",
      },
    );
    if (res.ok) {
      const json = (await res.json()) as { slug: string | null };
      const slug = json.slug ?? null;
      CACHE.set(host, {
        slug,
        expiresAt: Date.now() + (slug ? TTL_OK_MS : TTL_MISS_MS),
      });
      return slug;
    }
  } catch {
    // Network blip — cache as miss for 30s, browsers will retry.
  }
  CACHE.set(host, { slug: null, expiresAt: Date.now() + TTL_MISS_MS });
  return null;
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "")
    .split(":")[0]
    .toLowerCase();

  // Primary platform hosts + Vercel preview deploys → pass straight through.
  if (
    PRIMARY_HOSTS.has(host) ||
    host.endsWith(".vercel.app") ||
    host === "localhost" ||
    host.endsWith(".vercel.sh") ||
    host.startsWith("127.0.0.")
  ) {
    return NextResponse.next();
  }

  // For everything else we treat it as a custom domain. Strip www. so
  // siamsnack.com and www.siamsnack.com resolve to the same shop.
  const stripped = host.replace(/^www\./, "");

  // Internal API base — use VERCEL_URL on Vercel so we don't loop back
  // through the same custom domain; fallback to request origin in dev.
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : request.nextUrl.origin;

  const slug = await resolveHost(stripped, origin);
  if (!slug) {
    // Unknown custom host — let Next render its default 404 page.
    return NextResponse.next();
  }

  // Rewrite to the shop storefront. Preserve query + nested paths.
  // Apex `/` → `/s/{slug}` (no trailing slash mismatch on Next.js).
  const url = request.nextUrl.clone();
  const incoming = url.pathname;
  url.pathname =
    incoming === "/" ? `/s/${slug}` : `/s/${slug}${incoming}`;
  return NextResponse.rewrite(url);
}

// Match every request except internal Next assets + API + .well-known +
// our OG image routes (those use absolute URLs already + don't need the
// custom-domain rewrite).
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/data|favicon|icon|apple-touch-icon|.well-known|og|monitoring).*)",
  ],
};
