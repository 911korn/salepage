"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";

/**
 * Apple Guideline 1.2 compliance — the "report objectionable content"
 * mechanism every UGC surface must expose. One generic button used on
 * shop pages, product pages, review rows, story viewers, and live
 * comments. Targets are described as `{ kind, targetId }`; the server
 * resolves slugs into DB ids.
 */
export function ReportButton({
  kind,
  targetId,
  label,
  className,
}: {
  kind: "SHOP" | "PRODUCT" | "REVIEW" | "STORY" | "LIVE_COMMENT";
  targetId: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("INAPPROPRIATE");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, targetId, reason, note: note.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message || "ส่งรายงานไม่สำเร็จ");
        return;
      }
      if (json.alreadyReported) {
        toast.success("คุณรายงานเนื้อหานี้ไปแล้ว — ทีมงานกำลังตรวจสอบ");
      } else {
        toast.success("ขอบคุณที่รายงาน — ทีมงานจะตรวจสอบภายใน 24 ชม.");
      }
      setOpen(false);
      setNote("");
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
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50"
        }
      >
        <Flag className="size-3.5" />
        {label ?? "รายงาน"}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-semibold">รายงานเนื้อหานี้</h2>
            <p className="mt-1 text-[13px] text-zinc-600">
              ทีมงาน SalePage จะตรวจสอบและดำเนินการภายใน 24 ชั่วโมง
            </p>

            <div className="mt-4 space-y-2">
              <label className="block text-[13px] font-medium text-zinc-700">
                เหตุผล
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                <option value="INAPPROPRIATE">เนื้อหาไม่เหมาะสม / ลามก / รุนแรง</option>
                <option value="HARASSMENT">คุกคาม / ดูถูก / ก้าวร้าว</option>
                <option value="SPAM">สแปม / โฆษณาผิดที่</option>
                <option value="COUNTERFEIT">สินค้าปลอม / ละเมิดลิขสิทธิ์</option>
                <option value="ILLEGAL">สินค้า/เนื้อหาผิดกฎหมาย</option>
                <option value="MISLEADING">หลอกลวง / ข้อมูลเท็จ</option>
                <option value="OTHER">อื่น ๆ</option>
              </select>

              <label className="mt-3 block text-[13px] font-medium text-zinc-700">
                รายละเอียดเพิ่มเติม (ไม่บังคับ)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 1000))}
                rows={3}
                placeholder="บอกเราว่าเกิดอะไรขึ้น"
                className="w-full resize-none rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
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
                {submitting ? "กำลังส่ง…" : "ส่งรายงาน"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
