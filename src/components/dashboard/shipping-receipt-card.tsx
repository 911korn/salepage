"use client";

import { useState } from "react";
import { Check, Copy, Receipt } from "lucide-react";
import { toast } from "sonner";

/**
 * Persistent card on the order detail page showing the courier
 * receipt photo the seller uploaded for AI scan. Lives outside the
 * DropOffShippingPanel so it stays visible across SHIPPING →
 * DELIVERED (the panel hides itself once status leaves PAID/SHIPPING,
 * but the receipt belongs with the order forever). 911korn 2026-05-27
 * "มันควรคาอยู่ใน order นั้น แบบกดดูได้ + พร้อมโชว์ เลข Tracking แบบ
 * มีปุ่ม copy".
 */
interface Props {
  receiptUrl: string;
  trackingNumber: string | null;
  /** ISO string — server component passes order.shippingReceiptScannedAt?.toISOString() */
  scannedAt: string | null;
}

export function ShippingReceiptCard({
  receiptUrl,
  trackingNumber,
  scannedAt,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copyTracking() {
    if (!trackingNumber) return;
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      toast.success("คัดลอกเลขพัสดุแล้ว");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("คัดลอกไม่สำเร็จ — ลองอีกครั้ง");
    }
  }

  return (
    <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 text-sm sm:p-6">
      <div className="flex items-center gap-2">
        <Receipt className="size-4 text-zinc-500" />
        <h2 className="font-display text-base font-semibold">
          ใบเสร็จขนส่งที่ AI scan
        </h2>
      </div>

      {trackingNumber ? (
        <div className="mt-3 rounded-2xl bg-zinc-900 p-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            เลขพัสดุ
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="flex-1 truncate font-mono text-lg font-bold">
              {trackingNumber}
            </span>
            <button
              type="button"
              onClick={copyTracking}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-900 hover:bg-zinc-100 active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" />
                  คัดลอกแล้ว
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  คัดลอก
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}

      <a
        href={receiptUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-soft)] transition hover:border-zinc-300"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={receiptUrl}
          alt="Courier receipt"
          className="max-h-80 w-full object-contain"
        />
        <div className="border-t border-[color:var(--color-border)] px-3 py-2 text-[11px] font-medium text-zinc-500">
          กดเพื่อดูเต็มจอ
        </div>
      </a>

      {scannedAt ? (
        <p className="mt-2 text-right text-[10px] text-zinc-400">
          AI scan: {new Date(scannedAt).toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}
