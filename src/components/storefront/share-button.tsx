"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
  className?: string;
}

export function ShareButton({ title, text, url, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard_unavailable");
      }
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.top = "-1000px";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copiedWithCommand = document.execCommand("copy");
      document.body.removeChild(field);

      if (!copiedWithCommand) {
        throw new Error("copy_failed");
      }
    }

    setCopied(true);
    toast.success("คัดลอกลิงก์สินค้าแล้ว");
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handleShare() {
    const shareData = { title, text, url };

    try {
      if (typeof navigator.share === "function") {
        await navigator.share(shareData);
        return;
      }

      await copyLink();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      try {
        await copyLink();
      } catch {
        toast.error("แชร์ไม่สำเร็จ", {
          description: "ลองคัดลอกลิงก์จากแถบที่อยู่อีกครั้ง",
        });
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-[color:var(--color-brand-300)] hover:text-[color:var(--color-brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-500)] focus-visible:ring-offset-2 active:scale-[0.98]",
        className,
      )}
      aria-label={`แชร์ ${title}`}
    >
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      <span>แชร์</span>
    </button>
  );
}
