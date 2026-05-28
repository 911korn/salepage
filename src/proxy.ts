import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { ensureLiffReturnParam, resolveLiffStateTarget } from "@/lib/liff-url";

const intlMiddleware = createMiddleware(routing);

// Custom-domain rewrite (formerly src/middleware.ts). Merged into the
// single proxy file because Next.js 16 forbids `middleware.ts` and
// `proxy.ts` coexisting — that combo broke every prod build on
// 2026-05-28 afternoon.

const PRIMARY_HOSTS = new Set([
  "salepage.in.th",
  "www.salepage.in.th",
]);

const DOMAIN_CACHE = new Map<string, { slug: string | null; expiresAt: number }>();
const TTL_OK_MS = 5 * 60 * 1000;
const TTL_MISS_MS = 30 * 1000;

async function resolveCustomHost(host: string, origin: string): Promise<string | null> {
  const cached = DOMAIN_CACHE.get(host);
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
        cache: "no-store",
      },
    );
    if (res.ok) {
      const json = (await res.json()) as { slug: string | null };
      const slug = json.slug ?? null;
      DOMAIN_CACHE.set(host, {
        slug,
        expiresAt: Date.now() + (slug ? TTL_OK_MS : TTL_MISS_MS),
      });
      return slug;
    }
  } catch {
    // Network blip — short-cache as miss; browsers will retry.
  }
  DOMAIN_CACHE.set(host, { slug: null, expiresAt: Date.now() + TTL_MISS_MS });
  return null;
}

function isPrimaryHost(host: string) {
  return (
    PRIMARY_HOSTS.has(host) ||
    host.endsWith(".vercel.app") ||
    host === "localhost" ||
    host.endsWith(".vercel.sh") ||
    host.startsWith("127.0.0.")
  );
}

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();

  // Custom-domain branch: resolve host → shop slug → rewrite to the
  // locale-prefixed storefront route. We prepend the locale ourselves
  // (default `/th`, respect `/en` if buyer manually navigated) because
  // we return here before next-intl gets a chance to add it.
  if (!isPrimaryHost(host)) {
    const stripped = host.replace(/^www\./, "");
    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : request.nextUrl.origin;
    const slug = await resolveCustomHost(stripped, origin);
    if (slug) {
      const url = request.nextUrl.clone();
      const incoming = url.pathname;
      const localeMatch = incoming.match(/^\/(en|th)(?=\/|$)/);
      const localePrefix = localeMatch ? localeMatch[0] : "/th";
      const rest = localeMatch ? incoming.slice(localeMatch[0].length) : incoming;
      const shopPath =
        rest === "" || rest === "/" ? `/s/${slug}` : `/s/${slug}${rest}`;
      url.pathname = `${localePrefix}${shopPath}`;
      return NextResponse.rewrite(url);
    }
    // Unknown custom host → fall through; Next renders its default 404.
  }

  // Primary-host branch: LIFF state redirect first, then locale routing.
  const liffStateRedirect = redirectLiffState(request);
  if (liffStateRedirect) return liffStateRedirect;

  return intlMiddleware(request);
}

function redirectLiffState(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("liff.state");
  if (!state) return null;

  if (!isLiffStateShellPath(request.nextUrl.pathname)) {
    const currentTarget = new URL(request.nextUrl.toString());
    currentTarget.searchParams.delete("liff.state");
    const cleanTarget = ensureLiffReturnParam(currentTarget);
    return NextResponse.redirect(cleanTarget, 307);
  }

  const target = resolveLiffStateTarget(state, request.url);
  if (!target) return null;
  const cleanTarget = ensureLiffReturnParam(target);

  if (
    cleanTarget.pathname.startsWith("/api") ||
    cleanTarget.pathname.startsWith("/_next") ||
    cleanTarget.pathname.startsWith("/_vercel")
  ) {
    return null;
  }

  return NextResponse.redirect(cleanTarget, 307);
}

function isLiffStateShellPath(pathname: string) {
  return pathname === "/" || pathname === "/th" || pathname === "/en";
}

export const config = {
  // Skip intl rewriting for /auth/* (LIFF + OAuth-bridge surfaces that
  // must render at exactly the path LINE Developer Console points at,
  // no `/th/...` locale prefix), plus the standard api / _next / _vercel
  // / static asset exclusions.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
