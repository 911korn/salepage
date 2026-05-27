"use client";

import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";

/**
 * Digital fulfillment receipt card. High-contrast dark surface so the
 * delivered content (game ID:PW, license key, etc) reads like a
 * receipt rather than chrome — matches the mobile `<DigitalFulfillmentCard>`
 * pattern in `mobile/app/o/[token].tsx`.
 *
 * Copy-to-clipboard via the modern Async Clipboard API (works on every
 * https origin we ship to). Falls back silently if a buyer opens the
 * page on an unsupported browser.
 */
export function DigitalFulfillmentCard({
  content,
  fulfilledAt,
}: {
  content: string;
  fulfilledAt: string | null;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable; user can long-press select instead */
    }
  }
  return (
    <section className="overflow-hidden rounded-3xl bg-zinc-900 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} strokeWidth={2.4} />
          <h2 className="text-sm font-bold">เนื้อหาที่คุณได้รับ</h2>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold transition hover:bg-white/20"
        >
          <Copy size={12} strokeWidth={2.2} />
          {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </button>
      </header>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-[13px] leading-relaxed">
        {content}
      </pre>
      {fulfilledAt ? (
        <p className="px-5 pb-3 text-[11px] text-zinc-500">
          ส่งมอบ{" "}
          {new Date(fulfilledAt).toLocaleString("th-TH", {
            dateStyle: "short",
            timeStyle: "short",
          })}{" "}
          · เก็บอีเมลฉบับยืนยันการชำระเงินไว้ด้วยอีกหนึ่งช่องทาง
        </p>
      ) : null}
    </section>
  );
}
