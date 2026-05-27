"use client";

import { useEffect, useState } from "react";
import { Camera, Smartphone, Upload, Sparkles, Truck, X } from "lucide-react";

/**
 * First-purchase tutorial — web mirror of mobile/src/components/checkout-
 * tutorial-modal.tsx. Shown ONCE per browser on the tracking page so new
 * buyers learn the screenshot-QR → bank-app → upload-slip flow before
 * being dumped on the QR cold (911korn 2026-05-28).
 *
 * One-time tracking via localStorage. SSR-safe: state defaults to closed
 * and only opens after useEffect reads the storage flag (so server-render
 * matches client-render).
 */
const SEEN_KEY = "salepage:seen-checkout-tutorial";

export function CheckoutTutorialModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(SEEN_KEY);
      if (!seen) setOpen(true);
    } catch {
      /* private mode / sandboxed iframe — fail safe by not showing */
    }
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between bg-[color:var(--color-brand-50)] px-4 pt-3 pb-3">
          <div className="flex-1 pr-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">
              ครั้งแรกที่สั่ง?
            </p>
            <h2 className="mt-0.5 text-[17px] font-bold text-zinc-900">
              3 ขั้นตอน เสร็จใน 1 นาที
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="grid size-7 place-items-center rounded-full bg-white text-zinc-600 hover:bg-zinc-50"
            aria-label="ปิด"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <Step
            num={1}
            icon={Camera}
            title="แคปหน้าจอ QR code"
            body="ใช้นิ้วแคปหน้าจอเก็บ QR ไว้ก่อน"
          />
          <Step
            num={2}
            icon={Smartphone}
            title="เปิดแอปธนาคาร · สแกน QR"
            body="K Plus / SCB Easy / NEXT — สแกน QR → เลือกรูปที่แคป → ยืนยันโอน"
          />
          <Step
            num={3}
            icon={Upload}
            title="กลับมา Upload สลิปที่นี่"
            body="กดปุ่ม 'อัปสลิป' ด้านล่าง — ระบบจะอ่านสลิปให้เอง"
          />

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-emerald-600" />
              <p className="text-[12px] font-bold text-emerald-900">
                หลังจากนั้น Auto ทุกอย่าง
              </p>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-emerald-900">
              ✓ AI ตรวจสลิป 3 วิ · ออเดอร์ขึ้น "ชำระแล้ว" · ร้านเตรียมส่งของ
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-[color:var(--color-soft)] p-2.5">
            <Truck className="size-3.5 shrink-0 text-zinc-500" />
            <p className="text-[11px] leading-snug text-zinc-600">
              เงินถึงร้านตรงผ่าน PromptPay · ไม่ผ่านคนกลาง · ไม่หัก%
            </p>
          </div>
        </div>

        <div className="border-t border-[color:var(--color-border)] px-4 py-3">
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-2xl bg-[color:var(--color-brand-600)] py-2.5 text-[14px] font-semibold text-white transition hover:bg-[color:var(--color-brand-700)]"
          >
            เริ่มชำระเงิน
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  num,
  icon: Icon,
  title,
  body,
}: {
  num: number;
  icon: typeof Camera;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:var(--color-brand-600)] text-[14px] font-bold text-white">
        {num}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-zinc-900" />
          <p className="text-[14px] font-bold text-zinc-900">{title}</p>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{body}</p>
      </div>
    </div>
  );
}
