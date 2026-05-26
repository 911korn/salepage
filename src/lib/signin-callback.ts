import type { Locale } from "@/i18n/routing";

/**
 * Default post-signin destination. We send users to the buyer hub
 * (`/shops`) rather than the seller dashboard (911korn 2026-05-27: web
 * was seller-first, but most signed-in users are buyers — push them
 * straight to the shop discovery surface so they can shop right away).
 * Sellers can still reach `/dashboard` via the avatar menu in BuyerNav.
 */
export function defaultBuyerHomeForLocale(locale: Locale) {
  return locale === "th" ? "/shops" : `/${locale}/shops`;
}

const ALLOWED_PREFIXES = [
  "/shops",
  "/cart",
  "/search",
  "/me",
  "/dashboard",
  "/admin",
  "/o/",
  "/s/",
] as const;

export function normalizeDashboardCallbackUrl(
  value: string | string[] | null | undefined,
  locale: Locale,
) {
  const raw = Array.isArray(value) ? value[0] : value;
  const fallback = defaultBuyerHomeForLocale(locale);
  if (!raw) return fallback;

  try {
    const url = new URL(raw, "https://salepage.in.th");
    if (url.origin !== "https://salepage.in.th") return fallback;

    // Strip optional locale prefix before checking allowed roots.
    const prefix = `/${locale}`;
    const path = url.pathname.startsWith(prefix + "/") || url.pathname === prefix
      ? url.pathname.slice(prefix.length) || "/"
      : url.pathname;

    const allowed = ALLOWED_PREFIXES.some(
      (p) => path === p || path.startsWith(p + "/") || path.startsWith(p),
    );
    if (!allowed) return fallback;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
