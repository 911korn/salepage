import { i18n } from "@/lib/i18n";

/**
 * Formatting helpers — keep parity with web at src/lib (baht display, etc.).
 *
 * Money is stored in **satang** everywhere. Convert to baht only at render.
 *
 * String formatters (orderStatusLabel, formatRelativeTime) go through i18n
 * so EN locale renders English equivalents. Both call `i18n.t(...)` directly
 * because they're used outside React hooks (e.g. inside Stack.Screen options
 * or computed selectors).
 */

export function satangToBaht(satang: number | null | undefined): number {
  if (!satang) return 0;
  return Math.round(satang) / 100;
}

export function formatBaht(satang: number | null | undefined): string {
  const baht = satangToBaht(satang);
  return `฿${baht.toLocaleString("th-TH", {
    minimumFractionDigits: baht % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatBahtShort(satang: number | null | undefined): string {
  const baht = satangToBaht(satang);
  if (baht >= 1_000_000) return `฿${(baht / 1_000_000).toFixed(1)}M`;
  if (baht >= 1_000) return `฿${(baht / 1_000).toFixed(1)}k`;
  return `฿${baht.toLocaleString("th-TH")}`;
}

/** Translate an OrderStatus enum into a human label in the active locale. */
export function orderStatusLabel(status: string): string {
  const key = `common:orderStatus.${status}`;
  const translated = i18n.t(key) as string;
  // i18next returns the key string when no translation exists — fall back to
  // the raw enum so we don't dump "common:orderStatus.FOO" on screen.
  return translated === key ? status : translated;
}

/** Locale-aware relative time formatter ("5 minutes ago" / "5 นาทีก่อน"). */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return i18n.t("common:time.justNow") as string;
  if (minutes < 60)
    return i18n.t("common:time.minutesAgo", { count: minutes }) as string;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return i18n.t("common:time.hoursAgo", { count: hours }) as string;
  const days = Math.floor(hours / 24);
  if (days < 7)
    return i18n.t("common:time.daysAgo", { count: days }) as string;
  const lang = i18n.language || "th";
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
