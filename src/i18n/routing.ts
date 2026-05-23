import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["th", "en"],
  defaultLocale: "th",
  // Default locale (th) has no prefix; English routes get /en/...
  localePrefix: "as-needed",
  // Always default to Thai regardless of browser Accept-Language — we target
  // the Thai market first. Visitors get English only by explicitly visiting
  // /en/* or clicking the EN switcher.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const LOCALE_LABELS: Record<Locale, { native: string; flag: string }> = {
  th: { native: "ไทย", flag: "🇹🇭" },
  en: { native: "English", flag: "🇬🇧" },
};
