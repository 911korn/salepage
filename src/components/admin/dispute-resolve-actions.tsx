"use client";

import { useState, useTransition } from "react";
import {
  Check,
  RefreshCcw,
  ShieldX,
  MessageCircle,
  Building2,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";

interface Props {
  disputeId: string;
  shopName: string;
  orderTokenShort: string;
}

type ResolveAction =
  | "resolve_refund"
  | "resolve_replace"
  | "resolve_no_action"
  | "request_shop_response"
  | "request_buyer_response";

/**
 * Inline action bar for an admin dispute row.
 *
 * Two state-only buttons (request shop / request buyer response) fire
 * immediately. The three terminal resolutions open an inline notes form
 * since the backend requires a justification ≥ 5 chars.
 */
export function DisputeResolveActions({
  disputeId,
  shopName,
  orderTokenShort,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openForm, setOpenForm] = useState<ResolveAction | null>(null);
  const [notes, setNotes] = useState("");

  function fire(action: ResolveAction, payload: Record<string, unknown> = {}) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/admin/disputes/${disputeId}`, {
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
      toast.success(toastMessage(action, shopName));
      setOpenForm(null);
      setNotes("");
      router.refresh();
    });
  }

  function submitResolveForm() {
    if (!openForm) return;
    const trimmed = notes.trim();
    if (trimmed.length < 5) {
      toast.error("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
      return;
    }
    fire(openForm, { notes: trimmed });
  }

  if (openForm) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <textarea
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={resolveFormPlaceholder(openForm)}
          rows={2}
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-rose-300 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submitResolveForm}
            disabled={pending}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
              openForm === "resolve_refund"
                ? "bg-rose-600 hover:bg-rose-700"
                : openForm === "resolve_replace"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-zinc-700 hover:bg-zinc-800"
            }`}
          >
            ยืนยัน
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenForm(null);
              setNotes("");
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
        onClick={() => fire("request_shop_response")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
      >
        <Building2 className="size-4" />
        ขอให้ร้านตอบกลับ
      </button>
      <button
        type="button"
        onClick={() => fire("request_buyer_response")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 disabled:opacity-50"
      >
        <MessageCircle className="size-4" />
        ขอข้อมูลลูกค้า
      </button>
      <span className="hidden h-5 border-l border-zinc-200 sm:inline-block" />
      <button
        type="button"
        onClick={() => setOpenForm("resolve_refund")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
      >
        <ShieldX className="size-4" />
        คืนเงิน
      </button>
      <button
        type="button"
        onClick={() => setOpenForm("resolve_replace")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        <RefreshCcw className="size-4" />
        เปลี่ยนของ
      </button>
      <button
        type="button"
        onClick={() => setOpenForm("resolve_no_action")}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-50"
      >
        <Check className="size-4" />
        ยกฟ้อง
      </button>
      <span className="ml-1 text-xs text-zinc-400">#{orderTokenShort}</span>
    </div>
  );
}

function resolveFormPlaceholder(action: ResolveAction): string {
  switch (action) {
    case "resolve_refund":
      return "เหตุผลคืนเงิน เช่น: ของไม่ถึงจริง 14 วันแล้ว tracking ไม่อัปเดต";
    case "resolve_replace":
      return "เหตุผลเปลี่ยนของ เช่น: ร้านยินยอมส่งใหม่ ลูกค้าต้องการรอ";
    case "resolve_no_action":
      return "เหตุผลยกฟ้อง เช่น: tracking แสดงว่าได้รับแล้ว, ร้านส่งครบ";
    default:
      return "";
  }
}

function toastMessage(action: ResolveAction, shopName: string): string {
  switch (action) {
    case "resolve_refund":
      return `ตัดสินคืนเงิน ${shopName} แล้ว — Order CANCELLED + Trust ปรับลง`;
    case "resolve_replace":
      return `ตัดสินเปลี่ยนของ ${shopName} แล้ว — Trust ปรับลงเล็กน้อย`;
    case "resolve_no_action":
      return `ปิดข้อพิพาทโดยไม่มีการดำเนินการ — แจ้งเตือนลูกค้าแล้ว`;
    case "request_shop_response":
      return `ขอให้ ${shopName} ตอบกลับใน 72 ชม. แล้ว`;
    case "request_buyer_response":
      return `ขอข้อมูลเพิ่มจากลูกค้าแล้ว`;
  }
}
