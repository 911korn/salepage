"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";

/**
 * Buyer-side "ของถึงแล้ว — กดยืนยัน" CTA on /o/[token] when the order
 * is in SHIPPING. Closes the loop without a courier API. 911korn
 * 2026-05-27 "ระบบเรา Auto track เลข Tracking นั้น แล้วเอามาอัพเดท
 * สถานะออเดอร์เอง".
 *
 * Flow: tap → POST /api/v1/orders/[token]/mark-delivered → order
 * flips SHIPPING → DELIVERED. For escrow orders, this also releases
 * the hold to the shop immediately (same as /confirm-received).
 *
 * Fallback: a cron auto-flips DELIVERED after 7 days of SHIPPING for
 * buyers who never bother to click. See /api/v1/cron/auto-mark-delivered.
 */
export function ConfirmDeliveredButton({ token }: { token: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/orders/${token}/mark-delivered`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "ยืนยันไม่สำเร็จ");
        return;
      }
      toast.success("ขอบคุณที่ยืนยัน · ออเดอร์เสร็จสมบูรณ์", {
        description: "หากมีปัญหากับสินค้า สามารถเปิด dispute ได้ในหน้านี้",
        duration: 6000,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ยืนยันไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700">
          <CheckCircle2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-emerald-900">
            ของถึงแล้วใช่ไหม?
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-emerald-800">
            กดยืนยันให้ร้านรู้ว่าได้รับของแล้ว · ระบบจะปิดออเดอร์อัตโนมัติหลัง 7 วันถ้าไม่กด
          </p>
          <button
            type="button"
            onClick={confirm}
            disabled={submitting}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition active:scale-[0.99] disabled:opacity-60 sm:w-auto"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            ได้รับของแล้ว
          </button>
        </div>
      </div>
    </section>
  );
}
