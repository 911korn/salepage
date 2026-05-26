import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Apple Universal Links require this exact Content-Type. Without it iOS
  // refuses to associate the app. The file lives at
  // public/.well-known/apple-app-site-association (no extension) so Next.js
  // serves it statically; we only need to override the inferred MIME type.
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

const sentryEnabled =
  !!process.env.SENTRY_AUTH_TOKEN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT;

export default sentryEnabled
  ? withSentryConfig(withNextIntl(nextConfig), {
      org: process.env.SENTRY_ORG!,
      project: process.env.SENTRY_PROJECT!,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
      reactComponentAnnotation: { enabled: true },
      tunnelRoute: "/monitoring",
      automaticVercelMonitors: true,
    })
  : withNextIntl(nextConfig);
