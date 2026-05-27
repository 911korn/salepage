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

  // EAS Update — force-check on every cold start (911korn 2026-05-26:
  // "ติดตั้งระบบ OTA แบบ Force update ให้หน่อย ไม่ต้องสนใจใดๆ เข้าแอพใหม่
  // ให้ Auto check update ทุกรอบ"). The actual URL is filled in by
  // `eas update:configure` once we run it from the mobile/ dir.
  //
  // `runtimeVersion: policy=appVersion` pins JS bundles per-app-version,
  // so bumping `version` above forces a native rebuild rather than a
  // silent OTA — which is correct, because native code changes can't be
  // OTA'd safely.
  //
  // Cold-start force-apply logic lives in app/_layout.tsx — it checks
  // for an available update, downloads it, then reloadAsync() before
  // the React tree mounts, so users always run the latest JS bundle.
  runtimeVersion: { policy: "appVersion" },
  updates: {
    enabled: true,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
    // Hard-coded EAS Update URL for project 51fe1f0b-...-a38 (the
    // salepage-mobile project on the 911korn EAS account). The env-var
    // override stays for CI/preview channels that want a different URL.
    url:
      process.env.EXPO_PUBLIC_UPDATES_URL ??
      "https://u.expo.dev/51fe1f0b-8b8b-4305-9e97-cd4565948a38",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "in.th.salepage.mobile",
    // App Store Review Guideline 4.8: any app offering 3rd-party social
    // login (Google + LINE here) must also offer Sign in with Apple.
    // This entitlement enables `expo-apple-authentication`'s native flow.
    // 911korn 2026-05-27 "มี google Login ต้องมี apple Login เพราะเป็นกฏ".
    usesAppleSignIn: true,
    associatedDomains: ["applinks:salepage.in.th"],
    infoPlist: {
      // Apple requires this declaration for every new app since 2024-02
      // — `false` means we use only standard iOS crypto (TLS) and don't
      // need an export-compliance review. SalePage doesn't ship any
      // custom encryption.
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        "ใช้กล้องเพื่อถ่ายรูปสลิปการโอนเงิน · ถ่ายรูปสินค้า · ถ่ายรูปใบเสร็จขนส่งสำหรับ AI scan",
      NSPhotoLibraryUsageDescription:
        "เลือกรูปสลิป รูปสินค้า หรือรูปใบเสร็จขนส่งจากคลังภาพ",
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
    // expo-camera auto-injects RECORD_AUDIO for video capture, but we
    // only use still-image capture (slip + product photos). Strip it
    // so the Play listing doesn't surface a "may access microphone"
    // requirement to buyers (audit 2026-05-28).
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
    ],
    // Don't back up auth tokens / cart / seller state to Google Drive
    // — a stolen / shared device shouldn't restore a previous user's
    // session. SecureStore data is already excluded via keystore.
    allowBackup: false,
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
    "expo-apple-authentication",
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
    // expo-media-library powers the "use latest photo as slip" auto-
    // suggestion on the checkout screen — limited Photos access is
    // enough; we only read the single newest asset.
    [
      "expo-media-library",
      {
        photosPermission:
          "ดูรูปล่าสุดในคลังเพื่อแนะนำสลิปอัตโนมัติหลังโอนเงิน",
        savePhotosPermission:
          "บันทึก QR ลงในคลังภาพเพื่อใช้ในแอปธนาคาร",
        isAccessMediaLocationEnabled: false,
      },
    ],
    "expo-secure-store",
    "expo-notifications",
    "@sentry/react-native",
    "expo-video",
    // Required as explicit plugins from SDK 54 onwards (previously implicit).
    "expo-font",
    "expo-web-browser",
    "expo-localization",
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
    // Optional client config — only include fields when the env var is set.
    // We previously used `?? null` here, but Expo's manifest serializer turned
    // null into `{}` which broke fs.lstat in downstream plugins (`The "path"
    // argument must be of type string. Received an instance of Object`).
    // The env.ts reader does a `typeof === "string"` guard so missing keys
    // safely fall through to null on the client.
    ...(process.env.EXPO_PUBLIC_LINE_LIFF_ID
      ? { lineLiffId: process.env.EXPO_PUBLIC_LINE_LIFF_ID }
      : {}),
    ...(process.env.EXPO_PUBLIC_LINE_LOGIN_CHANNEL_ID
      ? { lineLoginChannelId: process.env.EXPO_PUBLIC_LINE_LOGIN_CHANNEL_ID }
      : {}),
    ...(process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID
      ? { googleOAuthClientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID }
      : {}),
    // CET TELEMETRY FIRST law: ship the DSN so init can fire on every cold
    // start. Without this, native crashes go uninvestigatable per the STOP
    // GUESSING crash debug rule.
    ...(process.env.EXPO_PUBLIC_SENTRY_DSN
      ? { sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN }
      : {}),
    // EAS project — created via `eas init` 2026-05-26 on the 911korn
    // account. Env var override kept for CI flexibility, but the static
    // default keeps `eas update` working out of the box.
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID ?? "51fe1f0b-8b8b-4305-9e97-cd4565948a38",
    },
  },
};

export default config;
