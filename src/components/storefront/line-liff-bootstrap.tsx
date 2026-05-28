"use client";

import { useEffect } from "react";
import {
  buildLiffRedirectUri,
  buildLiffUrl,
  cleanLiffReturnParam,
  cleanLiffStateParam,
  fetchLineConfig,
  hasLiffReturnParam,
  initLineLiff,
  isLineInAppBrowser,
  markLiffActive,
} from "@/lib/line-liff-client";

export function LineLiffBootstrap() {
  useEffect(() => {
    if (cleanLiffStateParam()) return;

    const params = new URL(window.location.href).searchParams;
    const returnedFromLiff = hasLiffReturnParam();
    const lineBrowser = isLineInAppBrowser();
    const shouldInit = params.has("liff.state") || returnedFromLiff || lineBrowser;
    if (!shouldInit) return;

    // Only auto-redirect to LIFF for routes our LIFF endpoint URL is
    // configured to handle (/o/[token] order tracking, /s/[slug] shop
    // pages, /line/* LIFF flows). The home page + marketing pages have
    // no LIFF endpoint so redirecting causes a LINE "Missing bridge id"
    // error — bail and let the page render normally in the in-app
    // browser. 911korn 2026-05-28 "salepage.in.th หน้าแรก เวลากดเข้า
    // ผ่านไลน์ให้มันเข้าได้เลย".
    const path = window.location.pathname;
    const liffEnabledPath =
      path.startsWith("/o/") ||
      path === "/o" ||
      path.startsWith("/s/") ||
      path === "/s" ||
      path.startsWith("/line/") ||
      path === "/line" ||
      // English-locale equivalents
      path.startsWith("/en/o/") ||
      path === "/en/o" ||
      path.startsWith("/en/s/") ||
      path === "/en/s" ||
      path.startsWith("/en/line/") ||
      path === "/en/line";
    if (lineBrowser && !returnedFromLiff && !liffEnabledPath) {
      return;
    }

    if (returnedFromLiff) {
      markLiffActive();
      cleanLiffReturnParam();
    }

    let cancelled = false;
    fetchLineConfig()
      .then((config) => {
        if (cancelled || !config.configured || !config.liffId) return null;

        if (lineBrowser && !returnedFromLiff) {
          window.location.replace(buildLiffUrl(config.liffId, window.location.href));
          return null;
        }

        if (returnedFromLiff || lineBrowser) {
          markLiffActive();
        }

        return initLineLiff(config.liffId, {
          withLoginOnExternalBrowser: lineBrowser || returnedFromLiff,
        });
      })
      .then((liff) => {
        if (cancelled || !liff) return;
        if (liff.isLoggedIn()) {
          markLiffActive();
          return;
        }

        if (lineBrowser || returnedFromLiff) {
          liff.login({ redirectUri: buildLiffRedirectUri() });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
