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
