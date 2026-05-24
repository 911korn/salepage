"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";

type PlanKey = "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";

interface Props {
  userId: string;
  currentPlan: PlanKey;
  disabled?: boolean;
  compact?: boolean;
}

const PLAN_OPTIONS: PlanKey[] = ["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"];

export function UserTierSelect({
  userId,
  currentPlan,
  disabled = false,
  compact = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [plan, setPlan] = useState<PlanKey>(currentPlan);
  const dirty = plan !== currentPlan;

  function save() {
    if (!dirty) return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "ปรับ Tier ไม่สำเร็จ");
        setPlan(currentPlan);
        return;
      }
      toast.success(`ปรับ Tier เป็น ${plan} แล้ว`);
      router.refresh();
    });
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "grid gap-2 sm:grid-cols-[1fr_auto]"}>
      <select
        value={plan}
        onChange={(e) => setPlan(e.target.value as PlanKey)}
        disabled={disabled || pending}
        className="h-10 min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
      >
        {PLAN_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={disabled || pending || !dirty}
        className="h-10 rounded-xl bg-[color:var(--color-brand-600)] px-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
      >
        {pending ? "..." : "บันทึก"}
      </button>
    </div>
  );
}
