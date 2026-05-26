"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";

interface Props {
  shopId: string;
  shopName: string;
}

/**
 * Approve / Reject buttons for a KYC submission row. Sends PATCH to
 * `/api/v1/admin/kyc/:id` and revalidates the page on success.
 *
 * Reject opens a small inline reason form because the backend requires a
 * non-empty `reason` (so the seller knows what to fix).
 */
export function KycReviewActions({ shopId, shopName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    if (!window.confirm(`อนุมัติ KYC ของ "${shopName}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/admin/kyc/${shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "อนุมัติไม่สำเร็จ");
        return;
      }
      toast.success(`อนุมัติ ${shopName} สำเร็จ — Trust +25, แจ้งเตือนเจ้าของแล้ว`);
      router.refresh();
    });
  }

  function reject() {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      toast.error("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/v1/admin/kyc/${shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: trimmed }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "ปฏิเสธไม่สำเร็จ");
        return;
      }
      toast.success(`ปฏิเสธ ${shopName} แล้ว — แจ้งเตือนเจ้าของพร้อมเหตุผล`);
      router.refresh();
    });
  }

  if (showRejectForm) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เหตุผลปฏิเสธ (เช่น: เอกสารเบลอ, เลข ID ไม่ตรง)"
          className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:border-rose-300 focus:outline-none"
        />
        <button
          type="button"
          onClick={reject}
          disabled={pending}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          ยืนยันปฏิเสธ
        </button>
        <button
          type="button"
          onClick={() => {
            setShowRejectForm(false);
            setReason("");
          }}
          disabled={pending}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          ยกเลิก
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={approve}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <Check className="size-4" />
        อนุมัติ
      </button>
      <button
        type="button"
        onClick={() => setShowRejectForm(true)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
      >
        <X className="size-4" />
        ปฏิเสธ
      </button>
    </div>
  );
}
