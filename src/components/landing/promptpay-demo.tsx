"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Banknote,
  Check,
  Copy,
  Download,
  QrCode,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  detectPromptPayIdType,
  normalizePromptPayId,
  type PromptPayIdType,
} from "@/lib/promptpay";
import { cn } from "@/lib/cn";

interface QrResponse {
  ok: true;
  data: { payload: string; dataUrl: string; svg: string; id: string; amount?: number };
}

const ID_TYPE_LABEL: Record<PromptPayIdType, string> = {
  phone: "เบอร์โทร",
  "national-id": "บัตรประชาชน",
  ewallet: "e-Wallet",
};

const FORMATTERS: Record<PromptPayIdType, (digits: string) => string> = {
  phone: (d) => d.replace(/^(\d{3})(\d{0,3})(\d{0,4}).*/, (_, a, b, c) =>
    [a, b, c].filter(Boolean).join("-"),
  ),
  "national-id": (d) =>
    d.replace(/^(\d{1})(\d{0,4})(\d{0,5})(\d{0,2})(\d{0,1}).*/, (_, a, b, c, e, f) =>
      [a, b, c, e, f].filter(Boolean).join("-"),
    ),
  ewallet: (d) => d.replace(/(\d{3})(?=\d)/g, "$1 ").trim(),
};

function formatId(value: string) {
  const digits = normalizePromptPayId(value);
  const type = detectPromptPayIdType(digits);
  if (!type) return value;
  return FORMATTERS[type](digits);
}

export function PromptPayDemo() {
  const [id, setId] = useState("0812345678");
  const [amount, setAmount] = useState("290");
  const [qr, setQr] = useState<QrResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const digits = normalizePromptPayId(id);
  const idType = detectPromptPayIdType(digits);

  useEffect(() => {
    if (!idType) {
      setQr(null);
      setError(digits.length === 0 ? null : "ใส่เบอร์ 10 หลัก หรือเลขบัตร 13 หลัก");
      return;
    }
    const parsedAmount = amount ? Number(amount.replace(/,/g, "")) : undefined;
    if (parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      setError("ยอดเงินไม่ถูกต้อง");
      return;
    }
    setError(null);
    setLoading(true);
    const ctrl = new AbortController();
    const debounce = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await fetch("/api/v1/promptpay/qr", {
            method: "POST",
            signal: ctrl.signal,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              id: digits,
              amount: parsedAmount && parsedAmount > 0 ? parsedAmount : undefined,
            }),
          });
          const json = (await res.json()) as QrResponse | { ok: false; error: { message: string } };
          if (!json.ok) {
            setError(json.error.message);
            return;
          }
          setQr(json.data);
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          setError("เกิดข้อผิดพลาดในการสร้าง QR");
        } finally {
          setLoading(false);
        }
      });
    }, 250);
    return () => {
      clearTimeout(debounce);
      ctrl.abort();
    };
  }, [digits, amount, idType]);

  return (
    <section
      id="promptpay"
      className="relative overflow-hidden border-y border-[color:var(--color-border)] bg-gradient-to-b from-white via-rose-50/40 to-white py-20 sm:py-24"
    >
      <div className="absolute inset-0 -z-10 bg-grid opacity-30" />
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)] shadow-sm">
            <QrCode className="size-3.5" /> ลองเล่นได้เลย
          </span>
          <h2 className="font-display mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            ใส่เบอร์ → ได้{" "}
            <span className="text-[color:var(--color-brand-600)]">PromptPay QR</span>
            <br className="hidden sm:block" /> ภายในเสี้ยววินาที
          </h2>
          <p className="mt-4 text-balance text-[17px] leading-relaxed text-zinc-600">
            ระบบสร้าง QR ตามมาตรฐานธนาคารแห่งประเทศไทย ลูกค้าสแกนจ่ายผ่านแอปธนาคารใดก็ได้
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:mt-14 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
          <div className="rounded-3xl border border-[color:var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
            <div className="space-y-5">
              <div>
                <label className="mb-2 flex items-center justify-between gap-2 text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="size-4 text-[color:var(--color-brand-600)]" /> PromptPay ID
                  </span>
                  {idType ? (
                    <Badge tone="soft-brand">
                      <Check className="size-3" /> {ID_TYPE_LABEL[idType]}
                    </Badge>
                  ) : null}
                </label>
                <Input
                  value={formatId(id)}
                  onChange={(e) => setId(e.target.value)}
                  inputMode="numeric"
                  placeholder="08x-xxx-xxxx หรือ เลขบัตร 13 หลัก"
                  className="h-13"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  รองรับเบอร์โทร 10 หลัก / เลขบัตรประชาชน 13 หลัก / e-wallet 15 หลัก
                </p>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <Banknote className="size-4 text-[color:var(--color-brand-600)]" /> ยอดเงิน (บาท)
                  <span className="text-xs font-normal text-zinc-500">— ไม่ใส่ก็ได้</span>
                </label>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  placeholder="เช่น 290"
                  prefix={<span className="font-semibold">฿</span>}
                  className="h-13"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[100, 290, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(String(preset))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        amount === String(preset)
                          ? "border-[color:var(--color-brand-600)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]"
                          : "border-[color:var(--color-border)] bg-white text-zinc-600 hover:border-[color:var(--color-brand-300)]",
                      )}
                    >
                      ฿{preset.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmount("")}
                    className="rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1 text-xs font-medium text-zinc-600 hover:border-[color:var(--color-brand-300)]"
                  >
                    Any amount
                  </button>
                </div>
              </div>

              {error ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="grid gap-3 rounded-2xl bg-[color:var(--color-soft)] p-4 sm:grid-cols-2">
                <SnippetRow label="POST" path="/api/v1/promptpay/qr" />
                <SnippetRow
                  label="GET"
                  path={`/api/v1/promptpay/qr?id=${digits || "<id>"}${amount ? `&amount=${amount}` : ""}`}
                />
              </div>
            </div>
          </div>

          <div className="relative rounded-3xl border border-[color:var(--color-border)] bg-gradient-to-br from-rose-50 via-white to-rose-50 p-6 sm:p-8">
            <div className="absolute inset-x-6 -top-2 flex items-center justify-between text-[11px] font-medium text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="size-3.5" /> สแกนด้วยแอปธนาคารใดก็ได้
              </span>
            </div>
            <div className="grid place-items-center">
              <motion.div
                key={qr?.payload ?? "empty"}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35 }}
                className="relative aspect-square w-full max-w-[300px] rounded-2xl border-2 border-[color:var(--color-brand-200)] bg-white p-4 shadow-xl shadow-rose-100"
              >
                {qr ? (
                  <img
                    src={qr.dataUrl}
                    alt="PromptPay QR"
                    className="size-full rounded-lg"
                  />
                ) : (
                  <div className="grid size-full place-items-center rounded-lg bg-zinc-50 text-zinc-400">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <QrCode className="size-12" />
                      <p className="text-xs">ใส่ PromptPay ID เพื่อสร้าง QR</p>
                    </div>
                  </div>
                )}
                {loading ? (
                  <div className="absolute inset-4 grid place-items-center rounded-lg bg-white/60 backdrop-blur-[2px]">
                    <span className="size-6 animate-spin rounded-full border-2 border-[color:var(--color-brand-600)] border-t-transparent" />
                  </div>
                ) : null}
              </motion.div>
            </div>

            <div className="mt-5 grid gap-2 text-center">
              {qr?.amount ? (
                <p className="font-display text-3xl font-bold text-[color:var(--color-brand-700)]">
                  ฿{qr.amount.toLocaleString("th-TH", { minimumFractionDigits: 0 })}
                </p>
              ) : qr ? (
                <p className="font-display text-xl font-semibold text-zinc-700">
                  ยอดเงินอิสระ
                </p>
              ) : null}
              {qr?.id ? (
                <p className="font-mono text-[13px] text-zinc-500">
                  {formatId(qr.id)} · {idType ? ID_TYPE_LABEL[idType] : ""}
                </p>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="md"
                disabled={!qr}
                onClick={() => {
                  if (!qr) return;
                  navigator.clipboard.writeText(qr.payload);
                  toast.success("คัดลอก payload แล้ว");
                }}
              >
                <Copy className="size-4" /> คัดลอก payload
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!qr}
                onClick={() => {
                  if (!qr) return;
                  const a = document.createElement("a");
                  a.href = qr.dataUrl;
                  a.download = `promptpay-${qr.id}${qr.amount ? `-${qr.amount}` : ""}.png`;
                  a.click();
                  toast.success("ดาวน์โหลด QR แล้ว");
                }}
              >
                <Download className="size-4" /> ดาวน์โหลด
              </Button>
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-zinc-500">
              <Sparkles className="size-3.5 text-[color:var(--color-brand-500)]" />
              สร้าง real-time จาก API ของเรา · ทดสอบจริงได้เลย
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SnippetRow({ label, path }: { label: string; path: string }) {
  return (
    <div className="flex items-center gap-2 overflow-hidden rounded-xl bg-white px-3 py-2 ring-1 ring-[color:var(--color-border)]">
      <span className="rounded-md bg-[color:var(--color-brand-50)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[color:var(--color-brand-700)]">
        {label}
      </span>
      <code className="truncate font-mono text-[12px] text-zinc-600">
        {path}
      </code>
    </div>
  );
}
