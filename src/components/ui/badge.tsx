import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "brand" | "neutral" | "success" | "warning" | "soft-brand";

const tones: Record<Tone, string> = {
  brand:
    "bg-[color:var(--color-brand-600)] text-white border-transparent",
  "soft-brand":
    "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] border border-[color:var(--color-brand-200)]",
  neutral:
    "bg-zinc-100 text-zinc-700 border border-zinc-200",
  success:
    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning:
    "bg-amber-50 text-amber-800 border border-amber-200",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
