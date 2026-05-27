"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Truck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shopee-style EasyParcel "เลือกขนส่ง → ปริ๊น → drop-off" panel.
 *
 * Mirrors `mobile/app/seller/orders/[token]/ship.tsx`. Pro-gated server
 * side — free-tier sellers see the manual ShippingWorkflow below as
 * the fallback. Tapping "เรียกราคา" hits /shipment/quote, renders a
 * rate picker, then /shipment/buy commits and opens the PDF in a new
 * tab for printing (911korn 2026-05-27).
 */

interface Rate {
  rateRef: string;
  courierCode: string;
  courierName: string;
  serviceName: string;
  priceSatang: number;
  etaDays: string;
}

interface Props {
  token: string;
  initialAwb: string | null;
  initialLabelUrl: string | null;
}

export function EasyParcelPanel({ token, initialAwb, initialLabelUrl }: Props) {
  const router = useRouter();
  const [weight, setWeight] = useState("500");
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [picked, setPicked] = useState<Rate | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [purchased, setPurchased] = useState<{
    awb: string;
    pdf: string;
    courier: string;
  } | null>(
    initialAwb && initialLabelUrl
      ? { awb: initialAwb, pdf: initialLabelUrl, courier: "" }
      : null,
  );

  async function getQuote() {
    const weightGram = Math.max(100, Math.min(50_000, Number(weight) || 0));
    setQuoteLoading(true);
    setRates(null);
    setPicked(null);
    try {
      const res = await fetch(`/api/v1/orders/${token}/shipment/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ weightGram }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { rates: Rate[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "เช็คราคาไม่สำเร็จ");
        return;
      }
      setRates(json.data!.rates);
    } finally {
      setQuoteLoading(false);
    }
  }

  async function buy() {
    if (!picked) return;
    setBuyLoading(true);
    try {
      const weightGram = Math.max(100, Math.min(50_000, Number(weight) || 0));
      const res = await fetch(`/api/v1/orders/${token}/shipment/buy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rateRef: picked.rateRef,
          courierCode: picked.courierCode,
          courierName: picked.courierName,
          serviceName: picked.serviceName,
          weightGram,
          shippingFeeSatang: picked.priceSatang,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { awbNumber: string; labelPdfUrl: string; courierName: string };
        error?: { code?: string; message?: string };
      };
      if (!res.ok || !json.ok) {
        if (json.error?.code === "pro_required") {
          toast.error("ออกใบปะหน้าอัตโนมัติเฉพาะ Pro+ — อัปเกรดที่ /billing");
          return;
        }
        toast.error(json.error?.message ?? "ออกใบปะหน้าไม่สำเร็จ");
        return;
      }
      const data = json.data!;
      setPurchased({
        awb: data.awbNumber,
        pdf: data.labelPdfUrl,
        courier: data.courierName,
      });
      window.open(data.labelPdfUrl, "_blank", "noopener,noreferrer");
      router.refresh();
    } finally {
      setBuyLoading(false);
    }
  }

  if (purchased) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-2">
          <Truck className="size-5 text-emerald-700" />
          <h2 className="text-base font-bold text-emerald-900">
            ออกใบปะหน้าแล้ว
          </h2>
        </div>
        {purchased.courier ? (
          <p className="mt-1 text-sm text-emerald-700">
            {purchased.courier}
          </p>
        ) : null}
        <p className="mt-2 font-mono text-lg font-bold text-emerald-900">
          {purchased.awb}
        </p>
        <a
          href={purchased.pdf}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <ExternalLink className="size-4" />
          เปิดใบปะหน้า (PDF) เพื่อปริ๊น
        </a>
        <p className="mt-3 text-[11px] leading-relaxed text-emerald-700">
          ปริ๊นใบปะหน้า ติดที่กล่อง แล้วเอาไป drop-off ที่จุดรับของ courier
          — ระบบจะอัปเดตสถานะให้ลูกค้าอัตโนมัติเมื่อ courier scan
          เข้าระบบ
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-zinc-900 bg-zinc-900 p-5 text-white">
      <div className="flex items-center gap-2">
        <Truck className="size-5" />
        <h2 className="text-base font-bold">ออกใบปะหน้าอัตโนมัติ</h2>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-zinc-300">
        เลือกขนส่ง → ปริ๊นใบปะหน้า → drop-off · เฉพาะแผน Pro+
      </p>

      <div className="mt-4 rounded-2xl bg-zinc-800 px-4 py-3">
        <label className="block text-[11px] uppercase tracking-wider text-zinc-400">
          น้ำหนักพัสดุ (กรัม)
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value.replace(/[^\d]/g, ""));
              setRates(null);
              setPicked(null);
            }}
            placeholder="500"
            className="w-32 bg-transparent text-xl font-bold outline-none"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={quoteLoading || Number(weight) < 100}
            onClick={getQuote}
            className="border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700"
          >
            {quoteLoading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : null}
            เรียกราคา
          </Button>
        </div>
      </div>

      {rates ? (
        <div className="mt-4 space-y-2">
          {rates.map((r) => {
            const isPicked = picked?.rateRef === r.rateRef;
            return (
              <button
                key={r.rateRef}
                onClick={() => setPicked(r)}
                className={`w-full rounded-2xl border p-3 text-left ${
                  isPicked
                    ? "border-white bg-white text-zinc-900"
                    : "border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">{r.courierName}</p>
                    <p
                      className={`text-[11px] ${
                        isPicked ? "text-zinc-500" : "text-zinc-400"
                      }`}
                    >
                      {r.serviceName} · ส่ง {r.etaDays} วัน
                    </p>
                  </div>
                  <p className="text-base font-bold">
                    ฿{(r.priceSatang / 100).toLocaleString()}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      <Button
        className="mt-5 w-full"
        disabled={!picked || buyLoading}
        onClick={buy}
      >
        {buyLoading ? <Loader2 className="size-4 animate-spin" /> : null}
        ยืนยัน · ออกใบปะหน้า
      </Button>
    </section>
  );
}
