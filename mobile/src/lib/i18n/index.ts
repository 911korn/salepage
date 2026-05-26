import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

import thCommon from "./locales/th/common.json";
import thHome from "./locales/th/home.json";
import thMe from "./locales/th/me.json";
import enCommon from "./locales/en/common.json";
import enHome from "./locales/en/home.json";
import enMe from "./locales/en/me.json";

/**
 * i18n foundation for the SalePage mobile app.
 *
 * Stack:
 *   - i18next runtime (translation engine + interpolation + plurals)
 *   - react-i18next bindings (`useTranslation()` hook)
 *   - expo-localization for device-locale detection on first launch
 *   - AsyncStorage for user-picked language persistence across cold starts
 *
 * Adding a new locale:
 *   1. Drop JSON files under `locales/<lang>/<namespace>.json`
 *   2. Import + add to `resources` below
 *   3. Add to `SUPPORTED_LANGS`
 *
 * Adding a new namespace:
 *   1. Create `locales/th/<ns>.json` + `locales/en/<ns>.json`
 *   2. Import + add to each locale's resources object
 *   3. Add to `NAMESPACES` array
 *
 * Component usage:
 *   ```tsx
 *   import { useTranslation } from "react-i18next";
 *   const { t } = useTranslation("common");
 *   <Text>{t("actions.save")}</Text>
 *   ```
 *
 * Multi-namespace usage:
 *   ```tsx
 *   const { t } = useTranslation(["common", "home"]);
 *   <Text>{t("home:searchPlaceholder")}</Text>
 *   ```
 */

export type AppLang = "th" | "en";

export const SUPPORTED_LANGS = ["th", "en"] as const;
export const FALLBACK_LANG: AppLang = "th";

export const NAMESPACES = ["common", "home", "me"] as const;
export type Namespace = (typeof NAMESPACES)[number];

const STORAGE_KEY = "salepage.lang.v1";

const resources = {
  th: {
    common: thCommon,
    home: thHome,
    me: thMe,
  },
  en: {
    common: enCommon,
    home: enHome,
    me: enMe,
  },
} as const;

/**
 * Pick a starting language. Order of preference:
 *   1. AsyncStorage `salepage.lang.v1` if the user has picked one before.
 *   2. Device locale if it matches a supported language.
 *   3. Fallback to Thai (most users).
 *
 * We resolve this before calling `i18n.init` so the very first render uses
 * the right language and we never see a TH→EN flash on launch.
 */
async function pickInitialLang(): Promise<AppLang> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === "th" || stored === "en") return stored;
  } catch {
    // Best-effort — fall through to device locale.
  }
  const device = Localization.getLocales()[0]?.languageCode ?? "th";
  if ((SUPPORTED_LANGS as readonly string[]).includes(device)) {
    return device as AppLang;
  }
  return FALLBACK_LANG;
}

let initPromise: Promise<typeof i18n> | null = null;

/**
 * Initialize i18next exactly once per app launch. Call this in `_layout.tsx`
 * before rendering routes — `await initI18n()` blocks the splash for a few
 * ms while we hydrate the saved language.
 */
export function initI18n(): Promise<typeof i18n> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const lng = await pickInitialLang();
    await i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: FALLBACK_LANG,
      ns: NAMESPACES as unknown as string[],
      defaultNS: "common",
      // RN doesn't need this, but the warning is loud without it.
      compatibilityJSON: "v4",
      interpolation: {
        // RN already escapes via JSX; double-escaping breaks Thai diacritics.
        escapeValue: false,
      },
      react: {
        // Suspense breaks RN's synchronous render cycle.
        useSuspense: false,
      },
    });
    return i18n;
  })();
  return initPromise;
}

/** Persist + apply the user's language choice. Triggers a re-render via i18next. */
export async function setAppLang(lang: AppLang): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export { i18n };
