"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  coupon: { id: string; active: boolean };
}

export function CouponRowActions({ coupon }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function call(method: "PATCH" | "DELETE", body: Record<string, unknown> | null, msg: string) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/admin/coupons/${coupon.id}`, {
        method,
        ...(body
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "ทำรายการไม่สำเร็จ");
        return;
      }
      toast.success(msg);
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 gap-1.5">
      {coupon.active ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => call("PATCH", { active: false }, "ปิดคูปองแล้ว")}
        >
          ปิด
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => call("PATCH", { active: true }, "เปิดคูปองแล้ว")}
        >
          เปิด
        </Button>
      )}
      <Button
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("ลบคูปองนี้?")) return;
          call("DELETE", null, "ลบคูปองแล้ว");
        }}
      >
        ลบ
      </Button>
    </div>
  );
}
