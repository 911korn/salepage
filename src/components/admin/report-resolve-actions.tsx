"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ContentReportStatus } from "@/lib/db";

export function ResolveActions({
  reportId,
  currentStatus,
}: {
  reportId: string;
  currentStatus: ContentReportStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function act(action: "remove" | "keep" | "review") {
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/reports/${reportId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.message || "ดำเนินการไม่สำเร็จ");
          return;
        }
        toast.success("บันทึกแล้ว");
        router.refresh();
      } catch {
        toast.error("เครือข่ายมีปัญหา");
      } finally {
        setBusy(false);
      }
    });
  }

  const disabled = pending || busy;

  if (
    currentStatus === ContentReportStatus.RESOLVED_REMOVED ||
    currentStatus === ContentReportStatus.RESOLVED_KEPT
  ) {
    return (
      <span className="text-[12px] text-zinc-500">ปิดรายงานแล้ว</span>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => act("review")}
        className="rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        เริ่มตรวจ
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => act("remove")}
        className="rounded-full bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
      >
        ลบเนื้อหา + ระงับผู้ใช้
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => act("keep")}
        className="rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        ไม่ผิด — ปิด
      </button>
    </>
  );
}
