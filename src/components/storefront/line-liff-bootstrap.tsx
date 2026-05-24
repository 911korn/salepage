"use client";

import { useEffect } from "react";
import {
  cleanLiffReturnParam,
  fetchLineConfig,
  hasLiffReturnParam,
  initLineLiff,
  isLineInAppBrowser,
  markLiffActive,
} from "@/lib/line-liff-client";

export function LineLiffBootstrap() {
  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    const returnedFromLiff = hasLiffReturnParam();
    const shouldInit =
      params.has("liff.state") || returnedFromLiff || isLineInAppBrowser();
    if (!shouldInit) return;

    if (returnedFromLiff || isLineInAppBrowser()) {
      markLiffActive();
    }
    if (returnedFromLiff) cleanLiffReturnParam();

    let cancelled = false;
    fetchLineConfig()
      .then((config) => {
        if (cancelled || !config.configured || !config.liffId) return null;
        return initLineLiff(config.liffId);
      })
      .then((liff) => {
        if (!cancelled && liff?.isLoggedIn()) markLiffActive();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
