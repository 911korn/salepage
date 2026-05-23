"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bell, Save } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";

interface Props {
  shopSlug: string;
  initial: string;
}

export function AnnouncementForm({ shopSlug, initial }: Props) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/shops/${shopSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcement: text.trim() || null }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "บันทึกไม่สำเร็จ");
        return;
      }
      toast.success("บันทึกประกาศแล้ว");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-5">
        <label className="text-[13px] font-semibold text-zinc-700">
          ข้อความประกาศ (สูงสุด 240 ตัวอักษร)
        </label>
        <textarea
          rows={3}
          maxLength={240}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="เช่น &quot;ส่งฟรีเมื่อสั่งเกิน ฿500 ตลอดเดือนนี้&quot;"
          className="mt-2 w-full resize-none rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
        />
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400">
          <span>เว้นว่างเพื่อปิดแบนเนอร์</span>
          <span>{text.length} / 240</span>
        </div>
      </div>

      {text.trim() ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            ตัวอย่าง
          </p>
          <div className="mt-2 flex items-start gap-3 rounded-xl bg-[color:var(--color-brand-50)] px-4 py-3 text-[13px] text-[color:var(--color-brand-800)] ring-1 ring-[color:var(--color-brand-100)]">
            <Bell className="size-4 shrink-0 text-[color:var(--color-brand-600)]" />
            <p className="leading-relaxed">{text}</p>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={cn(buttonStyles({ size: "sm" }), "gap-1.5")}
        >
          <Save className="size-4" />
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  );
}
