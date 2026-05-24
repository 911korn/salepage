import type { Locale } from "@/i18n/routing";

export function dashboardFallbackForLocale(locale: Locale) {
  return locale === "th" ? "/dashboard" : `/${locale}/dashboard`;
}

export function normalizeDashboardCallbackUrl(
  value: string | string[] | null | undefined,
  locale: Locale,
) {
  const raw = Array.isArray(value) ? value[0] : value;
  const fallback = dashboardFallbackForLocale(locale);
  if (!raw) return fallback;

  try {
    const url = new URL(raw, "https://salepage.in.th");
    if (url.origin !== "https://salepage.in.th") return fallback;
    if (
      url.pathname !== "/dashboard" &&
      !url.pathname.startsWith("/dashboard/") &&
      url.pathname !== `/${locale}/dashboard` &&
      !url.pathname.startsWith(`/${locale}/dashboard/`)
    ) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
