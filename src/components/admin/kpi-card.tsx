import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "brand" | "emerald" | "amber" | "violet" | "slate";

const toneStyles: Record<Tone, string> = {
  brand: "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  violet: "bg-violet-50 text-violet-700",
  slate: "bg-zinc-100 text-zinc-700",
};

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {label}
        </p>
        {Icon ? (
          <span className={cn("grid size-8 place-items-center rounded-lg", toneStyles[tone])}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="font-display mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}
