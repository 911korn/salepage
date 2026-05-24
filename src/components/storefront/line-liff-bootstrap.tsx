"use client";

import { useEffect } from "react";
import {
  fetchLineConfig,
  hasLiffReturnParam,
  initLineLiff,
  markLiffActive,
} from "@/lib/line-liff-client";

export function LineLiffBootstrap() {
  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    const shouldInit = params.has("liff.state") || hasLiffReturnParam();
    if (!shouldInit) return;

    if (hasLiffReturnParam()) {
      markLiffActive();
    }

    let cancelled = false;
    fetchLineConfig()
      .then((config) => {
        if (cancelled || !config.configured || !config.liffId) return null;
        return initLineLiff(config.liffId);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
