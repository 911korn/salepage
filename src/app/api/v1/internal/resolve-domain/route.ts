import { db, ShopDomainStatus } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Internal-only endpoint called by middleware (edge) to resolve a custom
 * host header → shop slug. Protected by `INTERNAL_RESOLVE_SECRET` so a
 * curl-er can't enumerate the mapping.
 *
 * Cache-friendly: response is HTTP-cached for 5min (s-maxage=300), with
 * stale-while-revalidate up to 30 min. The middleware also caches in-
 * memory for 5min so under load CF / Vercel serve from edge cache and
 * the underlying DB query runs at most a few times an hour per host.
 *
 * Returns { slug: null } for unknown / unverified hostnames — same
 * shape as the success response so the caller doesn't branch on type.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_RESOLVE_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  const url = new URL(request.url);
  const host = url.searchParams.get("host")?.toLowerCase().trim();
  if (!host) {
    return Response.json({ slug: null });
  }
  const stripped = host.replace(/^www\./, "");
  const row = await db.shopDomain.findUnique({
    where: { domain: stripped },
    select: {
      status: true,
      shop: { select: { slug: true } },
    },
  });
  const slug =
    row && row.status === ShopDomainStatus.VERIFIED ? row.shop.slug : null;

  return Response.json(
    { slug },
    {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}
