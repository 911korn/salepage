"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageSquareReply, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";

export interface ReviewView {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  productName: string | null;
  productSlug: string | null;
}

interface Props {
  shopSlug: string;
  initial: ReviewView[];
}

export function ReviewsManager({ shopSlug, initial }: Props) {
  const [reviews, setReviews] = useState<ReviewView[]>(initial);
  const [replying, setReplying] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function submitReply(id: string) {
    if (!draft.trim()) return;
    const res = await fetch(`/api/v1/shops/${shopSlug}/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: draft.trim() }),
    });
    const json = await res.json();
    if (!json.ok) {
      toast.error(json.error?.message ?? "ตอบกลับไม่สำเร็จ");
      return;
    }
    setReviews((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, reply: draft.trim(), repliedAt: new Date().toISOString() }
          : r,
      ),
    );
    setReplying(null);
    setDraft("");
    toast.success("ตอบกลับแล้ว");
  }

  async function remove(id: string) {
    if (!confirm("ลบรีวิวนี้?")) return;
    const res = await fetch(`/api/v1/shops/${shopSlug}/reviews/${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (json.ok) {
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast.success("ลบรีวิวแล้ว");
    }
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white px-6 py-14 text-center">
        <Star className="mx-auto size-8 text-zinc-300" />
        <p className="mt-3 font-display text-base font-semibold">
          ยังไม่มีรีวิว
        </p>
        <p className="mt-1 text-[13px] text-zinc-500">
          ลูกค้าให้รีวิวได้หลังจากออเดอร์ถูกจัดส่ง — ปุ่ม &quot;ให้รีวิว&quot; จะขึ้นในหน้าติดตามออเดอร์
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li
          key={r.id}
          className="rounded-2xl border border-[color:var(--color-border)] bg-white p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-[15px] font-semibold">
                  {r.customerName}
                </span>
                <Stars rating={r.rating} />
              </div>
              {r.productName ? (
                <p className="mt-0.5 text-[12px] text-zinc-500">
                  สินค้า: {r.productName}
                </p>
              ) : null}
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {new Date(r.createdAt).toLocaleDateString("th-TH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(r.id)}
              className="grid size-8 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          {r.comment ? (
            <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-zinc-700">
              {r.comment}
            </p>
          ) : null}

          {r.reply ? (
            <div className="mt-3 rounded-xl bg-[color:var(--color-soft)] p-3 text-[13px] leading-relaxed">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">
                คำตอบจากร้าน
              </p>
              <p className="mt-1 text-zinc-700">{r.reply}</p>
            </div>
          ) : replying === r.id ? (
            <div className="mt-3 space-y-2">
              <textarea
                rows={3}
                maxLength={2000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="ตอบลูกค้า..."
                className="w-full resize-none rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[color:var(--color-brand-400)]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReplying(null);
                    setDraft("");
                  }}
                  className={cn(buttonStyles({ size: "sm", variant: "outline" }))}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => submitReply(r.id)}
                  className={cn(buttonStyles({ size: "sm" }))}
                >
                  ส่งคำตอบ
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setReplying(r.id);
                setDraft("");
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline"
            >
              <MessageSquareReply className="size-3.5" /> ตอบกลับ
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i < rating
              ? "fill-amber-400 text-amber-400"
              : "fill-zinc-200 text-zinc-200",
          )}
        />
      ))}
    </span>
  );
}
