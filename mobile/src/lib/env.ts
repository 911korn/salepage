import Constants from "expo-constants";

interface AppEnv {
  apiBaseUrl: string;
  /**
   * Public-facing web URL for share links and Universal Links (always prod-style
   * domain, never the LAN IP). Fallback to https://salepage.in.th so share works
   * even when running in Expo Go against a dev API.
   */
  webBaseUrl: string;
  lineLiffId: string | null;
  lineLoginChannelId: string | null;
  /** Google OAuth client ID — same value as the web's `AUTH_GOOGLE_ID`. */
  googleOAuthClientId: string | null;
  /** Sentry DSN — null disables capture entirely (Expo Go / dev without DSN). */
  sentryDsn: string | null;
}

/**
 * Read the `extra` block from app.config.ts. Falls back to known prod URL when
 * a build was made without env (e.g. running Expo Go directly).
 */
export function getEnv(): AppEnv {
  const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ?? {};
  return {
    apiBaseUrl:
      typeof extra.apiBaseUrl === "string"
        ? extra.apiBaseUrl
        : "https://salepage.in.th",
    webBaseUrl:
      typeof extra.webBaseUrl === "string" && extra.webBaseUrl
        ? extra.webBaseUrl
        : "https://salepage.in.th",
    // LIFF id — hard-coded fallback so a fresh Expo Go scan that missed
    // the EXPO_PUBLIC_LINE_LIFF_ID env var doesn't break LINE login
    // entirely. The id is public anyway (it's the LIFF URL slug).
    lineLiffId:
      typeof extra.lineLiffId === "string" && extra.lineLiffId
        ? extra.lineLiffId
        : "2010178186-eE4vww3H",
    lineLoginChannelId:
      typeof extra.lineLoginChannelId === "string" && extra.lineLoginChannelId
        ? extra.lineLoginChannelId
        : null,
    googleOAuthClientId:
      typeof extra.googleOAuthClientId === "string" && extra.googleOAuthClientId
        ? extra.googleOAuthClientId
        : null,
    sentryDsn:
      typeof extra.sentryDsn === "string" && extra.sentryDsn
        ? extra.sentryDsn
        : null,
  };
}
