import type { ExpoConfig } from "expo/config";

/**
 * SalePage Mobile — Expo config
 *
 * - Custom scheme `salepage://` for deep links from email/LINE.
 * - Universal/App link via `salepage.in.th` (configured per platform below).
 * - Bundle/package id: in.th.salepage.mobile (matches Apple/Google conventions
 *   for Thai TLD apps).
 *
 * Public env vars are exposed via `extra` so non-EAS builds (Expo Go dev) can
 * read them without needing `EXPO_PUBLIC_*` prefixes for every consumer.
 */
const config: ExpoConfig = {
  name: "SalePage",
  slug: "salepage-mobile",
  version: "0.1.0",
  scheme: "salepage",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "in.th.salepage.mobile",
    associatedDomains: ["applinks:salepage.in.th"],
    infoPlist: {
      NSCameraUsageDescription:
        "ใช้กล้องเพื่อถ่ายรูปสลิปการโอนเงิน หรือสแกน QR ของสลิป",
      NSPhotoLibraryUsageDescription:
        "เลือกรูปสลิปจากคลังภาพเพื่อยืนยันการชำระเงิน",
      LSApplicationQueriesSchemes: [
        "line",
        "kbankline",
        "scbeasy",
        "bblmobilebanking",
        "krungthai",
        "ttbtouch",
        "uobapp",
      ],
    },
  },
  android: {
    package: "in.th.salepage.mobile",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    permissions: [
      "android.permission.CAMERA",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.POST_NOTIFICATIONS",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "salepage.in.th",
            pathPrefix: "/o",
          },
          {
            scheme: "https",
            host: "salepage.in.th",
            pathPrefix: "/s",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission:
          "ใช้กล้องเพื่อถ่ายสลิป / สแกน QR ของสลิปการโอนเงิน",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "เลือกรูปสลิปจากคลังภาพเพื่อยืนยันการชำระเงิน",
      },
    ],
    "expo-secure-store",
    "expo-notifications",
    "@sentry/react-native",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiBaseUrl:
      process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://salepage.in.th",
    // Always public domain — used for share links + Universal Links so they
    // resolve to the live site even when apiBaseUrl points at a LAN IP in dev.
    webBaseUrl:
      process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://salepage.in.th",
    lineLiffId: process.env.EXPO_PUBLIC_LINE_LIFF_ID ?? null,
    lineLoginChannelId:
      process.env.EXPO_PUBLIC_LINE_LOGIN_CHANNEL_ID ?? null,
    // CET TELEMETRY FIRST law: ship the DSN so init can fire on every cold
    // start. Without this, native crashes go uninvestigatable per the STOP
    // GUESSING crash debug rule.
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? null,
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? null,
    },
  },
};

export default config;
