"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";

interface Props {
  shopSlug: string;
  orderToken: string;
  productSlug?: string | null;
}

export function ReviewForm({ shopSlug, orderToken, productSlug }: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!rating) {
      toast.error("เลือกจำนวนดาวก่อน");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/shops/${shopSlug}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderToken,
          rating,
          comment: comment.trim() || null,
          productSlug,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ส่งรีวิวไม่สำเร็จ");
        return;
      }
      setDone(true);
      toast.success("ขอบคุณสำหรับรีวิว 💛");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-center sm:p-6">
        <Star className="mx-auto size-6 fill-amber-400 text-amber-400" />
        <p className="font-display mt-2 text-base font-semibold text-emerald-900">
          ขอบคุณสำหรับรีวิว
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold">ให้รีวิว</h2>
      <p className="mt-1 text-[13px] text-zinc-500">
        บอกเล่าประสบการณ์การซื้อของคุณ ช่วยร้านพัฒนาและลูกค้าคนอื่นตัดสินใจ
      </p>

      <div className="mt-4 flex items-center gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const v = i + 1;
          return (
            <button
              key={v}
              type="button"
              onMouseEnter={() => setHover(v)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(v)}
              className="transition-transform hover:scale-110"
              aria-label={`${v} ดาว`}
            >
              <Star
                className={cn(
                  "size-7 transition-colors",
                  (hover || rating) >= v
                    ? "fill-amber-400 text-amber-400"
                    : "fill-zinc-200 text-zinc-200",
                )}
              />
            </button>
          );
        })}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={2000}
        placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ)"
        rows={3}
        className="mt-3 w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[15px] outline-none focus:border-[color:var(--color-brand-400)]"
      />

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={saving || !rating}
          className={cn(buttonStyles({ size: "sm" }))}
        >
          {saving ? "กำลังส่ง..." : "ส่งรีวิว"}
        </button>
      </div>
    </section>
  );
}
