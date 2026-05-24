"use client";

import { useEffect, useMemo, useState } from "react";

interface Props {
  liffId: string;
  targetPath: string;
}

const LIFF_RETURN_PARAM = "sp_liff";

export function LineOpenBridge({ liffId, targetPath }: Props) {
  const [showFallback, setShowFallback] = useState(false);
  const urls = useMemo(() => buildLineOpenUrls(liffId, targetPath), [liffId, targetPath]);

  useEffect(() => {
    const ua = navigator.userAgent;
    const embeddedSocial = /FBAN|FBAV|FB_IAB|Instagram/i.test(ua);
    const inLine = /\bLine\//i.test(ua);
    const fallbackTimer = window.setTimeout(() => setShowFallback(true), 1200);
    let webFallbackTimer: number | undefined;

    if (inLine) {
      window.location.replace(urls.liffUrl);
    } else if (embeddedSocial) {
      window.location.href = urls.lineSchemeUrl;
    } else {
      window.location.href = urls.lineSchemeUrl;
      webFallbackTimer = window.setTimeout(() => {
        if (!document.hidden) window.location.href = urls.liffUrl;
      }, 800);
    }

    return () => {
      window.clearTimeout(fallbackTimer);
      if (webFallbackTimer) window.clearTimeout(webFallbackTimer);
    };
  }, [urls]);

  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6 text-center text-zinc-900">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-5 size-10 animate-pulse rounded-full bg-[#06C755]" />
        <h1 className="font-display text-xl font-bold">กำลังเปิด LINE</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          ระบบกำลังพาคุณไปต่อใน LINE เพื่อยืนยันตัวตนและดูสถานะออเดอร์
        </p>

        {showFallback ? (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => {
                window.location.href = urls.lineSchemeUrl;
              }}
              className="h-12 w-full rounded-2xl bg-[#06C755] px-4 text-base font-bold text-white shadow-lg shadow-emerald-100 active:scale-[0.99]"
            >
              เปิด LINE เพื่อดำเนินการต่อ
            </button>
            <a
              href={urls.liffUrl}
              className="block rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700"
            >
              เปิดผ่าน LINE Login
            </a>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function buildLineOpenUrls(liffId: string, targetPath: string) {
  const target = new URL(targetPath, "https://salepage.in.th");
  target.searchParams.set(LIFF_RETURN_PARAM, "1");
  const path = `${target.pathname}${target.search}${target.hash}`;

  return {
    liffUrl: `https://liff.line.me/${liffId}${path}`,
    lineSchemeUrl: `line://app/${liffId}${path}`,
  };
}
