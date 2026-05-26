"use client";

import { useState, useTransition } from "react";
import { Check, X, Wallet } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";

interface Props {
  payoutId: string;
  status: string;
  amountSatang: number;
  promptpayId: string;
}

type FormMode = null | "mark_paid" | "reject";

/**
 * Inline action bar for an admin affiliate payout row.
 *
 * Actions depend on current status:
 *   - REQUESTED  → Approve | Reject
 *   - APPROVED   → Mark Paid (with txn ref) | Reject
 *   - PAID/REJECTED/CANCELLED → none (terminal)
 */
export function PayoutActions({
  payoutId,
  status,
  amountSatang,
  promptpayId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<FormMode>(null);
  const [providerRef, setProviderRef] = useState("");
  const [reason, setReason] = useState("");

  function fire(action: string, payload: Record<string, unknown> = {}) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/admin/payouts/${payoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: { message: string };
      };
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "ดำเนินการไม่สำเร็จ");
        return;
      }
      const baht = (amountSatang / 100).toLocaleString();
      const successMsg =
        action === "approve"
          ? `อนุมัติ ${baht} ฿ แล้ว — โอน PromptPay ${promptpayId}`
          : action === "mark_paid"
            ? `ทำเครื่องหมายโอนแล้ว — แจ้งผู้ใช้แล้ว`
            : `ปฏิเสธ ${baht} ฿ แล้ว — ยอดถูกปลดล็อก`;
      toast.success(successMsg);
      setMode(null);
      setProviderRef("");
      setReason("");
      router.refresh();
    });
  }

  if (mode === "mark_paid") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          autoFocus
          type="text"
          value={providerRef}
          onChange={(e) => setProviderRef(e.target.value)}
          placeholder="Transaction ref (e.g. SCB-20260526-0001)"
          className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:border-emerald-300 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const trimmed = providerRef.trim();
              if (trimmed.length < 2) {
                toast.error("กรุณาระบุ ref ของธุรกรรม");
                return;
              }
              fire("mark_paid", { providerRef: trimmed });
            }}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            ยืนยันโอนแล้ว
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(null);
              setProviderRef("");
            }}
            disabled={pending}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  if (mode === "reject") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          autoFocus
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เหตุผล (เช่น: PromptPay ผิด, ตรวจสอบไม่ผ่าน)"
          className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:border-rose-300 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const trimmed = reason.trim();
              if (trimmed.length < 5) {
                toast.error("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
                return;
              }
              fire("reject", { reason: trimmed });
            }}
            disabled={pending}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            ยืนยันปฏิเสธ
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(null);
              setReason("");
            }}
            disabled={pending}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  // Render valid actions per current status.
  const isRequested = status === "REQUESTED";
  const isApproved = status === "APPROVED";

  if (!isRequested && !isApproved) {
    return (
      <span className="text-xs text-zinc-400">ไม่มีการดำเนินการเพิ่มเติม</span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isRequested ? (
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`อนุมัติเบิก ${(amountSatang / 100).toLocaleString()} ฿ ?`))
              return;
            fire("approve");
          }}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check className="size-4" />
          อนุมัติ
        </button>
      ) : null}
      {isApproved ? (
        <button
          type="button"
          onClick={() => setMode("mark_paid")}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Wallet className="size-4" />
          โอนแล้ว
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setMode("reject")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
      >
        <X className="size-4" />
        ปฏิเสธ
      </button>
    </div>
  );
}
