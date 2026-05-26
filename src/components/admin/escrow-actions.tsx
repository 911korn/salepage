"use client";

import { useState, useTransition } from "react";
import { ArrowDownToLine, Undo2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";

interface Props {
  holdId: string;
  status: string;
  amountSatang: number;
}

type FormMode = null | "release" | "refund";

/**
 * Inline action bar for an escrow hold row. Two manual transitions admins
 * can take: release (push to shop) or refund (push to buyer). Both require
 * an `adminNote` for the audit trail.
 *
 * Hidden for RELEASED/REFUNDED rows — those are terminal and only readable
 * for historical audit.
 */
export function EscrowActions({ holdId, status, amountSatang }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<FormMode>(null);
  const [note, setNote] = useState("");

  const isTerminal = status === "RELEASED" || status === "REFUNDED";

  function fire(action: "release" | "refund") {
    const trimmed = note.trim();
    if (trimmed.length < 3) {
      toast.error("กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/v1/admin/escrow/${holdId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: trimmed }),
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
      toast.success(
        action === "release"
          ? `ปล่อย ${baht} ฿ ให้ร้านแล้ว`
          : `คืน ${baht} ฿ ให้ผู้ซื้อแล้ว`,
      );
      setMode(null);
      setNote("");
      router.refresh();
    });
  }

  if (isTerminal) {
    return (
      <span className="text-xs text-zinc-400">ปิดไปแล้ว ไม่มี action</span>
    );
  }

  if (mode !== null) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          autoFocus
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            mode === "release"
              ? "เหตุผลปล่อยเงิน (เช่น: ลูกค้ายืนยันทางอื่นแล้ว)"
              : "เหตุผลคืนเงิน (เช่น: ร้านปิดถาวร)"
          }
          className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm focus:border-emerald-300 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fire(mode)}
            disabled={pending}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
              mode === "release"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {mode === "release" ? "ยืนยันปล่อย" : "ยืนยันคืนเงิน"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(null);
              setNote("");
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setMode("release")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <ArrowDownToLine className="size-4" />
        ปล่อยให้ร้าน
      </button>
      <button
        type="button"
        onClick={() => setMode("refund")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
      >
        <Undo2 className="size-4" />
        คืนผู้ซื้อ
      </button>
    </div>
  );
}
