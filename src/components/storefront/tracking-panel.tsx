"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, Check, Loader2, Upload, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";

interface Props {
  token: string;
  amount: number;
  receiver: string;
  qrDataUrl: string | null;
  shopName: string;
}

interface MismatchEntry {
  field: "amount" | "receiver";
  expected?: unknown;
  got?: unknown;
}

interface SlipResult {
  verified: boolean;
  status?: string;
  slipRef?: string;
  mismatch?: MismatchEntry[];
  duplicate?: boolean;
  provider?: string;
}

export function TrackingPanel({
  token,
  amount,
  receiver,
  qrDataUrl,
  shopName,
}: Props) {
  const t = useTranslations("order.tracking");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SlipResult | null>(null);

  function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("ไฟล์ต้องเป็นรูปภาพ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      // Strip "data:image/png;base64," prefix for our API contract
      const base64 = dataUrl.split(",")[1] ?? dataUrl;
      setSubmitting(true);
      startTransition(async () => {
        try {
          const res = await fetch(`/api/v1/orders/${token}/slip`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ imageBase64: base64 }),
          });
          const json = await res.json();
          if (!res.ok || !json.ok) {
            toast.error(json.error?.message ?? "ตรวจสลิปไม่สำเร็จ");
            return;
          }
          setResult(json.data as SlipResult);
          if (json.data.verified) {
            toast.success(t("verified"));
            // Reload the server-rendered page to flip to PAID view
            setTimeout(() => router.refresh(), 1200);
          } else {
            toast.error(t("rejected"));
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "ตรวจสลิปไม่สำเร็จ");
        } finally {
          setSubmitting(false);
        }
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      {/* QR section */}
      <section className="rounded-3xl border border-[color:var(--color-brand-200)] bg-gradient-to-br from-rose-50 via-white to-rose-50 p-5 shadow-xl shadow-rose-100/40 sm:p-7">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-600">
            <Wallet className="size-3.5" /> {t("scanToPay")}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)] ring-1 ring-[color:var(--color-brand-200)]">
            PromptPay
          </span>
        </div>

        <div className="mt-4 grid place-items-center">
          {qrDataUrl ? (
            <div className="aspect-square w-full max-w-[280px] rounded-2xl border-2 border-[color:var(--color-brand-200)] bg-white p-3 shadow-lg shadow-rose-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="PromptPay QR" className="size-full" />
            </div>
          ) : (
            <div className="grid aspect-square w-full max-w-[280px] place-items-center rounded-2xl border-2 border-dashed border-rose-200 bg-white text-zinc-400">
              <p className="text-sm">QR ไม่พร้อม</p>
            </div>
          )}
        </div>

        <div className="mt-5 text-center">
          <p className="text-xs text-zinc-500">{t("amountLabel")}</p>
          <p className="font-display text-3xl font-bold text-[color:var(--color-brand-700)]">
            ฿{amount.toLocaleString()}
          </p>
          {receiver ? (
            <p className="mt-1 font-mono text-[11px] text-zinc-500">
              เข้าบัญชี {shopName} · {maskTail(receiver)}
            </p>
          ) : null}
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-zinc-600">
            {t("promptpayHint")}
          </p>
        </div>
      </section>

      {/* Slip upload */}
      <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 sm:p-7">
        <h2 className="font-display flex items-center gap-2 text-base font-semibold">
          <Upload className="size-4 text-[color:var(--color-brand-600)]" />{" "}
          {t("uploadSlip")}
        </h2>

        <label
          htmlFor="slip-upload"
          className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--color-border)] bg-[color:var(--color-soft)] px-5 py-8 text-center transition-colors hover:border-[color:var(--color-brand-300)] hover:bg-[color:var(--color-brand-50)]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) onFile(file);
          }}
        >
          {submitting || pending ? (
            <>
              <Loader2 className="size-6 animate-spin text-[color:var(--color-brand-600)]" />
              <span className="text-sm font-medium">{t("uploading")}</span>
            </>
          ) : (
            <>
              <Upload className="size-6 text-zinc-400" />
              <span className="text-[13px] text-zinc-600">{t("uploadHint")}</span>
            </>
          )}
          <input
            ref={fileRef}
            id="slip-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </label>

        {result && !result.verified ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">{t("rejected")}</p>
              <ul className="mt-1 list-disc pl-4 text-[13px]">
                {result.duplicate ? (
                  <li>{t("duplicate")}</li>
                ) : null}
                {result.mismatch?.map((m, i) => (
                  <li key={i}>
                    {m.field === "amount"
                      ? t("mismatchAmount", {
                          got: String(m.got ?? "?"),
                          expected: String(m.expected ?? "?"),
                        })
                      : t("mismatchReceiver")}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        {result?.verified ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <Check className="mt-0.5 size-4 shrink-0" />
            <span>{t("verified")}</span>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function maskTail(id: string) {
  const digits = id.replace(/\D/g, "");
  if (digits.length < 4) return digits;
  return "xxx-x-x" + digits.slice(-4);
}
