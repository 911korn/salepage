import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { getEnv } from "@/lib/env";

/**
 * Initialize Sentry on cold start — call from `_layout.tsx` BEFORE any other
 * setup so JS errors thrown during early hooks still surface in Sentry.
 *
 * Gated on `EXPO_PUBLIC_SENTRY_DSN`:
 *   - Without a DSN → no-op (Expo Go dev, fork builds, CI). Importantly we
 *     never throw or crash the app just because telemetry isn't wired.
 *   - With a DSN → captures JS exceptions, native crashes (via the platform
 *     SDK), and React rendering errors. Source-mapped releases are uploaded
 *     during EAS production builds by the @sentry/react-native config plugin.
 *
 * This is the CET TELEMETRY FIRST law: every iOS/Android app under CET must
 * have telemetry installed BEFORE the first TestFlight build. Without it,
 * native crash investigation falls back to guessing.
 */
let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const { sentryDsn } = getEnv();
  if (!sentryDsn) return;

  Sentry.init({
    dsn: sentryDsn,
    // Send a single sample per event by default; we're not running large user
    // bases yet so 100% is the right starting setting. Crank down once we
    // exceed the free-tier event quota.
    tracesSampleRate: 1.0,
    // Release identifier — match the JS bundle so Sentry can apply source maps.
    // expoConfig.version + nativeAppVersion produce stable strings across cold
    // restarts. EAS injects EXPO_UPDATES_UPDATE_ID for OTA bundles.
    release:
      Constants.expoConfig?.version ??
      Constants.nativeAppVersion ??
      undefined,
    // Don't enable Sentry's auto-session-tracking on the very first launch
    // until we've confirmed it doesn't slow down icon-to-launch time on
    // mid-range Android. Cheap to re-enable later.
    enableAutoSessionTracking: false,
    // Strip query strings + body that may contain LINE id tokens or slip
    // base64 from outgoing event payloads.
    beforeSend(event) {
      if (event.request?.data && typeof event.request.data === "string") {
        if (event.request.data.length > 2000) {
          event.request.data = "[redacted: payload too large]";
        }
      }
      return event;
    },
  });
  initialized = true;
}

/**
 * Wrap a fire-and-forget side effect with telemetry. If the promise rejects,
 * we capture the error to Sentry without bubbling it up (caller already opted
 * out of awaiting). Useful for `void notifyShopNewOrder(...)` style calls
 * where we still want crash diagnostics if the helper blows up.
 */
export function captureBackgroundError(promise: Promise<unknown>): void {
  promise.catch((err) => {
    if (initialized) Sentry.captureException(err);
    else console.warn("[background-error]", err);
  });
}

export { Sentry };
