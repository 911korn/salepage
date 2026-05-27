"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

/**
 * Apple Guideline 1.2 — "block abusive users" button. Lives on each
 * shop page. POST /api/v1/blocks upserts a UserBlock + auto-files a
 * report so the admin queue is notified. Buyer's feeds (search,
 * follows, recommendations) exclude blocked shops at query time, so
 * the content is removed instantly.
 */
export function BlockButton({
  shopSlug,
  label,
  className,
}: {
  shopSlug: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopSlug }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message || "บล็อกไม่สำเร็จ");
        return;
      }
      toast.success(
        "บล็อกแล้ว — ร้านนี้จะไม่ขึ้นในฟีดของคุณอีก และทีมงานได้รับแจ้งแล้ว",
      );
      setConfirming(false);
      router.refresh();
    } catch {
      toast.error("เครือข่ายมีปัญหา ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50"
        }
      >
        <Ban className="size-3.5" />
        {label ?? "บล็อกร้านนี้"}
      </button>

      {confirming ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirming(false);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-semibold">บล็อกร้านนี้?</h2>
            <p className="mt-2 text-[14px] text-zinc-700 leading-relaxed">
              ร้านนี้จะหายจากการค้นหา ฟีดสินค้า และรายการร้านที่คุณติดตามทันที
              เราจะแจ้งทีมงานให้ตรวจสอบเนื้อหาที่ไม่เหมาะสมภายใน 24 ชั่วโมง.
              คุณยกเลิกการบล็อกได้ภายหลังจากหน้าโปรไฟล์.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submit}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {submitting ? "กำลังบล็อก…" : "บล็อก"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
