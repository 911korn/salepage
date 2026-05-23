"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  shop: {
    id: string;
    slug: string;
    suspended: boolean;
    featured: boolean;
    verified: boolean;
    slipCredits: number;
    lineWebhookEnabled: boolean;
  };
}

export function ShopActions({ shop }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creditDelta, setCreditDelta] = useState("100");

  function patch(body: Record<string, unknown>, successMsg: string) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/admin/shops/${shop.id}`, {
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="font-display text-base font-semibold">การจัดการ</h2>

      <div className="mt-4 flex flex-wrap gap-2">
        {shop.suspended ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => patch({ suspended: false }, "ปลด suspend ร้านแล้ว")}
          >
            ปลด suspend
          </Button>
        ) : (
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Suspend ร้านนี้? หน้าร้านจะ 503"))
                return;
              patch({ suspended: true }, "Suspend ร้านแล้ว");
            }}
          >
            Suspend
          </Button>
        )}

        <Button
          size="sm"
          variant={shop.featured ? "secondary" : "outline"}
          disabled={pending}
          onClick={() =>
            patch(
              { featured: !shop.featured },
              shop.featured ? "เลิก feature แล้ว" : "Feature ร้านแล้ว",
            )
          }
        >
          {shop.featured ? "เลิก feature" : "Feature"}
        </Button>

        <Button
          size="sm"
          variant={shop.verified ? "secondary" : "outline"}
          disabled={pending}
          onClick={() =>
            patch(
              { verified: !shop.verified },
              shop.verified ? "เลิก verified แล้ว" : "ติ๊กถูก verified",
            )
          }
        >
          {shop.verified ? "เลิก verified" : "Verify"}
        </Button>
      </div>

      <div className="mt-5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          เติม Slip credits
        </label>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          ยอดปัจจุบัน: <span className="font-mono">{shop.slipCredits}</span>
        </p>
        <div className="mt-1.5 flex gap-2">
          <Input
            type="number"
            value={creditDelta}
            onChange={(e) => setCreditDelta(e.target.value)}
            className="h-10 flex-1"
            min={-shop.slipCredits}
          />
          <Button
            size="sm"
            disabled={pending || !creditDelta}
            onClick={() => {
              const delta = Number(creditDelta);
              if (!Number.isFinite(delta) || delta === 0) {
                toast.error("ใส่จำนวนที่ไม่ใช่ 0");
                return;
              }
              patch(
                { slipCreditsDelta: delta },
                `${delta > 0 ? "เติม" : "หัก"} ${Math.abs(delta).toLocaleString()} เครดิตแล้ว`,
              );
            }}
          >
            {Number(creditDelta) >= 0 ? "เติม" : "หัก"}
          </Button>
        </div>
      </div>

      <div className="mt-5 border-t border-zinc-100 pt-4">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          LINE webhook
        </label>
        <div className="mt-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              patch(
                { lineWebhookEnabled: !shop.lineWebhookEnabled },
                shop.lineWebhookEnabled
                  ? "ปิด LINE webhook แล้ว"
                  : "เปิด LINE webhook แล้ว",
              )
            }
          >
            {shop.lineWebhookEnabled ? "ปิด LINE" : "เปิด LINE"}
          </Button>
        </div>
      </div>
    </div>
  );
}
