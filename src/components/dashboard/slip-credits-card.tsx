"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SLIP_PACKS,
  type SlipCapacity,
  type SlipPackKey,
} from "@/lib/slip-credits-shared";

interface Props {
  shopSlug: string;
  capacity: SlipCapacity;
}

const PACK_ORDER: SlipPackKey[] = ["p50", "p150", "p500", "p1500", "p5000"];

export function SlipCreditsCard({ shopSlug, capacity }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [loadingPack, setLoadingPack] = useState<SlipPackKey | null>(null);

  // Show a toast when the user returns from a successful Stripe checkout.
  // success_url puts ?credits=ok&pack=<key> on /dashboard/settings.
  useEffect(() => {
    const url = new URL(window.location.href);
    const credits = url.searchParams.get("credits");
    const pack = url.searchParams.get("pack") as SlipPackKey | null;
    if (credits === "ok" && pack) {
      const meta = SLIP_PACKS[pack];
      if (meta) {
        toast.success(
          `เติม ${meta.slips.toLocaleString()} slip credits สำเร็จ — เครดิตจะเข้าภายในไม่กี่นาที`,
        );
      }
      url.searchParams.delete("credits");
      url.searchParams.delete("pack");
      window.history.replaceState({}, "", url.toString());
    } else if (credits === "cancel") {
      toast.info("ยกเลิกการซื้อ credit pack แล้ว");
      url.searchParams.delete("credits");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  function buy(pack: SlipPackKey) {
    setLoadingPack(pack);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/billing/checkout-credits", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pack, shopSlug }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: { url?: string };
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data?.url) {
          toast.error(json.error?.message ?? "เปิดหน้าซื้อไม่สำเร็จ");
          return;
        }
        window.location.href = json.data.url;
      } finally {
        setLoadingPack(null);
      }
    });
  }

  const quotaPct =
    capacity.monthlyQuota > 0
      ? Math.min(100, (capacity.monthlyUsed / capacity.monthlyQuota) * 100)
      : 0;

  return (
    <section className="rounded-2xl border border-[color:var(--color-border)] bg-white p-5">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-[color:var(--color-brand-600)]" />
            AI Slip Credits
          </h2>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            ใช้ตรวจสลิปอัตโนมัติเมื่อลูกค้าโอน — แผน{" "}
            <Badge tone="soft-brand" className="text-[10px]">
              {capacity.plan}
            </Badge>{" "}
            ได้ {capacity.monthlyQuota.toLocaleString()} ครั้ง/เดือน
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setPickerOpen((v) => !v)}
        >
          เติมเครดิต
        </Button>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat
          label="ใช้ไปเดือนนี้"
          value={`${capacity.monthlyUsed.toLocaleString()} / ${capacity.monthlyQuota.toLocaleString()}`}
        />
        <Stat
          label="เครดิตคงเหลือ"
          value={capacity.credits.toLocaleString()}
          tone={capacity.credits === 0 ? "muted" : "brand"}
        />
        <Stat
          label="รวมเช็คได้อีก"
          value={capacity.totalRemaining.toLocaleString()}
          tone={capacity.totalRemaining < 10 ? "warn" : "default"}
        />
      </div>

      {capacity.monthlyQuota > 0 ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={
                quotaPct >= 80
                  ? "h-full bg-amber-500"
                  : "h-full bg-[color:var(--color-brand-500)]"
              }
              style={{ width: `${Math.max(2, quotaPct)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            {capacity.quotaRemaining.toLocaleString()} ครั้ง โควต้าแผนเหลือ ·
            หลังจากนั้นจะหักจาก credits
          </p>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          แผน {capacity.plan} ไม่มีโควต้าเช็คสลิปรายเดือน —{" "}
          {capacity.credits === 0
            ? "ต้องเติม credit ก่อนถึงจะใช้ระบบตรวจสลิปได้"
            : `ใช้เครดิตคงเหลือ ${capacity.credits.toLocaleString()} ครั้ง`}
        </p>
      )}

      {pickerOpen ? (
        <div className="mt-4 grid gap-2 border-t border-zinc-100 pt-4 sm:grid-cols-5">
          {PACK_ORDER.map((key) => {
            const meta = SLIP_PACKS[key];
            const loading = loadingPack === key;
            return (
              <button
                key={key}
                type="button"
                disabled={pending}
                onClick={() => buy(key)}
                className="rounded-xl border border-zinc-200 bg-white p-3 text-center transition-colors hover:border-[color:var(--color-brand-300)] hover:bg-[color:var(--color-brand-50)] disabled:opacity-60"
              >
                <p className="font-display text-base font-bold">
                  {meta.slips.toLocaleString()}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  สลิป
                </p>
                <p className="font-display mt-1 text-sm font-bold text-[color:var(--color-brand-700)]">
                  ฿{meta.priceBaht.toLocaleString()}
                </p>
                <p className="text-[10px] text-zinc-500">
                  ฿{meta.perSlipBaht.toFixed(2)}/สลิป
                </p>
                {loading ? (
                  <p className="mt-1 text-[10px] text-zinc-400">กำลังเปิด…</p>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <p className="mt-3 text-[11px] text-zinc-500">
        <Wallet className="mr-0.5 inline size-3 align-text-bottom" />
        ชำระด้วยบัตรเครดิตหรือ PromptPay · เครดิตไม่หมดอายุ
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "brand" | "warn" | "muted";
}) {
  const colorClass =
    tone === "brand"
      ? "text-[color:var(--color-brand-700)]"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "muted"
          ? "text-zinc-400"
          : "";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`font-display mt-1 text-lg font-bold tracking-tight ${colorClass}`}>
        {value}
      </p>
    </div>
  );
}
