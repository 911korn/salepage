"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";

/**
 * In-app browser banner.
 *
 * Why this exists: Google's OAuth (and increasingly Apple's) blocks
 * sign-in inside webviews like LINE, Facebook, Instagram, Messenger,
 * and TikTok. The user clicks "Continue with Google" and the modal
 * either stalls or shows a "this browser may not be supported" error
 * (911korn 2026-05-27 IMG_5547: LINE in-app browser stuck on Google
 * sign-in).
 *
 * Behavior:
 *  - Detect known in-app webviews via UA sniff (runs client-side).
 *  - When detected, render a sticky amber banner above the form with:
 *    1. Friendly explanation in Thai.
 *    2. "Copy link" button (Clipboard API).
 *    3. "Open in Safari/Chrome" button using platform-specific intent
 *       URLs so the user doesn't need to navigate menus.
 *
 * The detection is conservative — we'd rather hide the banner for a
 * regular browser than spam it. False positives erode trust.
 */
const IN_APP_PATTERNS: RegExp[] = [
  /\bLine\//i,
  /\bFBAN\//,
  /\bFBAV\//,
  /\bFB_IAB\b/,
  /\bInstagram\b/,
  /\bMessenger\b/,
  /\bmusical_ly\b/,
  /\bBytedanceWebview\b/i,
  /\bMicroMessenger\b/,
  /\bKAKAOTALK\b/,
  // GitHub mobile, TikTok dev sandbox, etc — last resort generic webview hint
  /; wv\)/,
];

function detectInAppBrowser(ua: string): boolean {
  return IN_APP_PATTERNS.some((p) => p.test(ua));
}

function getPlatform(ua: string): "ios" | "android" | "other" {
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export function InAppBrowserBanner() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (detectInAppBrowser(ua)) {
      setShow(true);
      setPlatform(getPlatform(ua));
    }
  }, []);

  if (!show) return null;

  const url = typeof window !== "undefined" ? window.location.href : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("คัดลอกลิงก์แล้ว — เปิดในเบราว์เซอร์ปกติ");
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  }

  function openExternal() {
    if (platform === "ios") {
      // iOS doesn't have a reliable URL scheme to force Safari from a
      // webview (`x-safari-https://...` was removed). Best UX: copy the
      // link + show instructions. The user taps the in-app browser's
      // "Open in Safari" menu item.
      copy();
      toast.info('แตะที่ปุ่ม "..." แล้วเลือก "Open in Safari"', {
        duration: 6000,
      });
      return;
    }
    if (platform === "android") {
      // Chrome intent — opens the same URL in Chrome on Android.
      const intent = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.href = intent;
      return;
    }
    copy();
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex gap-3">
        <Info className="size-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            กรุณาเปิดในเบราว์เซอร์ปกติ
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
            Google ปิดกั้นการ Sign in ใน in-app browser (LINE / Facebook / Instagram)
            เพื่อความปลอดภัย — โปรดเปิดลิงก์นี้ใน Safari หรือ Chrome
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openExternal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700"
            >
              <ExternalLink className="size-3.5" />
              {platform === "android" ? "เปิดใน Chrome" : "วิธีเปิดใน Safari"}
            </button>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-800 hover:bg-amber-50"
            >
              <Copy className="size-3.5" /> คัดลอกลิงก์
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
