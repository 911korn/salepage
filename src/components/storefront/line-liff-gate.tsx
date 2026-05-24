"use client";

import { useEffect, useState } from "react";
import {
  buildLiffUrl,
  cleanLiffReturnParam,
  fetchLineConfig,
  hasLiffReturnParam,
  initLineLiff,
  isLiffActiveSession,
  markLiffActive,
} from "@/lib/line-liff-client";

export function LineLiffGate() {
  const [blocking, setBlocking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const config = await fetchLineConfig();
      if (cancelled) return;
      if (!config.configured || !config.liffId) {
        setBlocking(false);
        return;
      }

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
        return;
      }

      setBlocking(false);
    }

    run().catch(() => {
      if (!cancelled) setBlocking(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!blocking) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-white px-6 text-center">
      <div>
        <div className="mx-auto mb-5 size-10 animate-pulse rounded-full bg-[#06C755]" />
        <p className="font-display text-lg font-bold text-zinc-900">
          กำลังยืนยันผ่าน LINE
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          ระบบกำลังพาไปเช็กสถานะออเดอร์อย่างปลอดภัย
        </p>
      </div>
    </div>
  );
}
