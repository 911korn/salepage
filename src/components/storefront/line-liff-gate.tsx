"use client";

import { useEffect } from "react";
import {
  buildLiffUrl,
  cleanLiffReturnParam,
  fetchLineConfig,
  hasLiffReturnParam,
  initLineLiff,
  isLiffActiveSession,
  isLineInAppBrowser,
  markLiffActive,
} from "@/lib/line-liff-client";

export function LineLiffGate() {
  useEffect(() => {
    if (!isLineInAppBrowser()) return;

    let cancelled = false;

    async function run() {
      const config = await fetchLineConfig();
      if (cancelled || !config.configured || !config.liffId) return;

      const returnedFromLiff = hasLiffReturnParam();
      if (returnedFromLiff) {
        markLiffActive();
        cleanLiffReturnParam();
      }

      if (!returnedFromLiff && !isLiffActiveSession()) {
        window.location.replace(buildLiffUrl(config.liffId, window.location.href));
        return;
      }

      const liff = await initLineLiff(config.liffId);
      if (cancelled) return;
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
      }
    }

    run().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
