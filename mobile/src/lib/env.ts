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
    lineLiffId:
      typeof extra.lineLiffId === "string" && extra.lineLiffId
        ? extra.lineLiffId
        : null,
    lineLoginChannelId:
      typeof extra.lineLoginChannelId === "string" && extra.lineLoginChannelId
        ? extra.lineLoginChannelId
        : null,
  };
}
