"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

interface Swatch {
  name: string;
  hex: string;
  textOn?: "light" | "dark";
}

interface Props {
  title: string;
  swatches: Swatch[];
}

export function ColorPalette({ title, swatches }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(hex: string) {
    await navigator.clipboard.writeText(hex);
    setCopied(hex);
    toast.success(`${hex} copied`);
    setTimeout(() => setCopied((cur) => (cur === hex ? null : cur)), 1500);
  }

  return (
    <div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {swatches.map((s) => (
          <button
            key={s.name + s.hex}
            type="button"
            onClick={() => copy(s.hex)}
            className="group relative flex aspect-[3/4] flex-col items-start justify-end overflow-hidden rounded-xl p-2.5 text-left transition-transform hover:scale-[1.02]"
            style={{ background: s.hex }}
          >
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wider",
                s.textOn === "dark" ? "text-white/80" : "text-black/60",
              )}
            >
              {s.name}
            </span>
            <span
              className={cn(
                "font-mono text-[11px] font-semibold",
                s.textOn === "dark" ? "text-white" : "text-black",
              )}
            >
              {s.hex}
            </span>
            <span
              className={cn(
                "absolute right-2 top-2 grid size-6 place-items-center rounded-md backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100",
                s.textOn === "dark" ? "bg-white/15 text-white" : "bg-black/10 text-black/70",
              )}
            >
              {copied === s.hex ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
