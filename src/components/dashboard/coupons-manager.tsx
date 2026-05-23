"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Ticket, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";

export interface CouponView {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  percent: number | null;
  amountSatang: number | null;
  minOrderSatang: number | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: string | null;
  active: boolean;
}

interface Props {
  shopSlug: string;
  initial: CouponView[];
}

export function CouponsManager({ shopSlug, initial }: Props) {
  const [coupons, setCoupons] = useState<CouponView[]>(initial);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [percent, setPercent] = useState(10);
  const [amountBaht, setAmountBaht] = useState(50);
  const [minOrderBaht, setMinOrderBaht] = useState(0);
  const [maxRedemptions, setMaxRedemptions] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  async function create() {
    if (!code.trim()) {
      toast.error("ใส่รหัสคูปอง");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        code: code.trim(),
        type,
      };
      if (type === "PERCENT") body.percent = percent;
      else body.amountSatang = Math.max(100, Math.round(amountBaht * 100));
      if (minOrderBaht > 0) body.minOrderSatang = Math.round(minOrderBaht * 100);
      if (maxRedemptions) body.maxRedemptions = Number(maxRedemptions);
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();

      const res = await fetch(`/api/v1/shops/${shopSlug}/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "สร้างไม่สำเร็จ");
        return;
      }
      setCoupons((prev) => [json.data.coupon, ...prev]);
      toast.success("สร้างคูปองแล้ว");
      setCode("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(c: CouponView) {
    const res = await fetch(`/api/v1/shops/${shopSlug}/coupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    const json = await res.json();
    if (json.ok) {
      setCoupons((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)),
      );
    }
  }

  async function remove(c: CouponView) {
    if (!confirm(`ลบคูปอง ${c.code.toUpperCase()}?`)) return;
    const res = await fetch(`/api/v1/shops/${shopSlug}/coupons/${c.id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (json.ok) {
      setCoupons((prev) => prev.filter((x) => x.id !== c.id));
      toast.success("ลบคูปองแล้ว");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-zinc-500">
          {coupons.length === 0
            ? "ยังไม่มีคูปอง"
            : `มี ${coupons.length} คูปอง`}
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(buttonStyles({ size: "sm" }), "gap-1.5")}
        >
          <Plus className="size-4" /> สร้างคูปอง
        </button>
      </div>

      {open ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-5">
          <p className="font-display text-base font-semibold">สร้างคูปองใหม่</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="รหัสคูปอง">
              <input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))
                }
                placeholder="WELCOME10"
                maxLength={40}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-[14px] font-mono outline-none focus:border-[color:var(--color-brand-400)]"
              />
            </Field>
            <Field label="ประเภทส่วนลด">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[color:var(--color-brand-400)]"
              >
                <option value="PERCENT">เปอร์เซ็นต์</option>
                <option value="FIXED">จำนวนเงิน</option>
              </select>
            </Field>
            {type === "PERCENT" ? (
              <Field label="เปอร์เซ็นต์ส่วนลด">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value))}
                  className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[color:var(--color-brand-400)]"
                />
              </Field>
            ) : (
              <Field label="ส่วนลด (บาท)">
                <input
                  type="number"
                  min={1}
                  value={amountBaht}
                  onChange={(e) => setAmountBaht(Number(e.target.value))}
                  className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[color:var(--color-brand-400)]"
                />
              </Field>
            )}
            <Field label="ยอดสั่งซื้อขั้นต่ำ (บาท, ไม่บังคับ)">
              <input
                type="number"
                min={0}
                value={minOrderBaht}
                onChange={(e) => setMinOrderBaht(Number(e.target.value))}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[color:var(--color-brand-400)]"
              />
            </Field>
            <Field label="จำนวนการใช้สูงสุด (เว้นว่าง = ไม่จำกัด)">
              <input
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[color:var(--color-brand-400)]"
              />
            </Field>
            <Field label="หมดอายุ (ไม่บังคับ)">
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[color:var(--color-brand-400)]"
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={cn(buttonStyles({ size: "sm", variant: "outline" }))}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={create}
              disabled={saving}
              className={cn(buttonStyles({ size: "sm" }))}
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      ) : null}

      {coupons.length === 0 ? null : (
        <ul className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white">
          {coupons.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 border-b border-[color:var(--color-border)] px-5 py-4 last:border-b-0"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
                <Ticket className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-semibold uppercase">
                  {c.code}
                </p>
                <p className="mt-0.5 text-[12px] text-zinc-500">
                  {c.type === "PERCENT"
                    ? `ลด ${c.percent}%`
                    : `ลด ฿${Math.round((c.amountSatang ?? 0) / 100).toLocaleString()}`}
                  {c.minOrderSatang
                    ? ` · ขั้นต่ำ ฿${Math.round(c.minOrderSatang / 100).toLocaleString()}`
                    : ""}
                  {c.maxRedemptions
                    ? ` · ใช้แล้ว ${c.redeemedCount}/${c.maxRedemptions}`
                    : c.redeemedCount > 0
                      ? ` · ใช้แล้ว ${c.redeemedCount}`
                      : ""}
                  {c.expiresAt
                    ? ` · หมดอายุ ${new Date(c.expiresAt).toLocaleDateString("th-TH")}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(c)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
                  c.active
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200",
                )}
              >
                {c.active ? "เปิด" : "ปิด"}
              </button>
              <button
                type="button"
                onClick={() => remove(c)}
                className="grid size-8 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                aria-label="ลบคูปอง"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
