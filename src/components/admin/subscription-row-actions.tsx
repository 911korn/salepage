"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";

interface Props {
  subscription: {
    id: string;
    cancelAtPeriodEnd: boolean;
  };
}

export function SubscriptionRowActions({ subscription }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function patch(body: Record<string, unknown>, successMsg: string) {
    startTransition(async () => {
      setOpen(false);
      const res = await fetch(`/api/v1/admin/subscriptions/${subscription.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "ทำรายการไม่สำเร็จ");
        return;
      }
      toast.success(successMsg);
      router.refresh();
    });
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
      >
        จัดการ
        <ChevronDown className="size-3" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={() => patch({ extendDays: 30 }, "ขยายอายุ +30 วันแล้ว")}
              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-zinc-50"
            >
              ขยาย +30 วัน
            </button>
            <button
              type="button"
              onClick={() => patch({ extendDays: 90 }, "ขยายอายุ +90 วันแล้ว")}
              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-zinc-50"
            >
              ขยาย +90 วัน
            </button>
            <button
              type="button"
              onClick={() => patch({ extendDays: 365 }, "ขยายอายุ +1 ปีแล้ว")}
              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-zinc-50"
            >
              ขยาย +1 ปี
            </button>
            <div className="border-t border-zinc-100" />
            {subscription.cancelAtPeriodEnd ? (
              <button
                type="button"
                onClick={() =>
                  patch({ cancelAtPeriodEnd: false }, "ยกเลิก auto-cancel แล้ว")
                }
                className="block w-full px-3 py-2 text-left text-[12px] hover:bg-zinc-50"
              >
                ยกเลิก auto-cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(
                      "ตั้งให้ subscription นี้หยุดต่ออายุเมื่อรอบนี้จบ?",
                    )
                  )
                    return;
                  patch({ cancelAtPeriodEnd: true }, "ตั้ง auto-cancel แล้ว");
                }}
                className="block w-full px-3 py-2 text-left text-[12px] text-amber-700 hover:bg-amber-50"
              >
                Cancel at period end
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
