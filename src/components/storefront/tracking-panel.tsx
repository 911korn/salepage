"use client";

import { useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  MessageCircle,
  Phone,
  Upload,
  Wallet,
} from "lucide-react";
import jsQR from "jsqr";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";

interface Props {
  token: string;
  amount: number;
  receiver: string;
  qrDataUrl: string | null;
  shopName: string;
  initialManualReview?: boolean;
  shopContact?: ShopContact;
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
  slipImageUrl?: string | null;
  manualReview?: boolean;
  mismatch?: MismatchEntry[];
  duplicate?: boolean;
  provider?: string;
  reason?: string;
  message?: string;
  shopContact?: ShopContact;
}

interface ShopContact {
  phone?: string | null;
  phoneUrl?: string | null;
  line?: string | null;
  lineUrl?: string | null;
}

export function TrackingPanel({
  token,
  amount,
  receiver,
  qrDataUrl,
  shopName,
  initialManualReview = false,
  shopContact,
}: Props) {
  const t = useTranslations("order.tracking");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SlipResult | null>(null);

  const manualReview = Boolean(
    result?.manualReview || (!result && initialManualReview),
  );
  const manualContact = result?.shopContact ?? shopContact;

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
          const qrPayload = await readQrPayloadFromImage(dataUrl);
          const res = await fetch(`/api/v1/orders/${token}/slip`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              ...(qrPayload ? { qrPayload } : {}),
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.ok) {
            toast.error(json.error?.message ?? "ตรวจสลิปไม่สำเร็จ");
            return;
          }
          setResult(json.data as SlipResult);
          if (json.data.manualReview) {
            toast.success(t("manualReviewToast"));
            setTimeout(() => router.refresh(), 1000);
          } else if (json.data.verified) {
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
            <div className="aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl border-2 border-[color:var(--color-brand-200)] bg-white p-3 shadow-lg shadow-rose-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="PromptPay QR"
                className="block h-full w-full object-contain"
              />
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

        {manualReview ? (
          <ManualReviewNotice
            contact={manualContact}
            title={t("manualReviewTitle")}
            description={t("manualReviewDesc")}
            lineLabel={t("manualReviewLine")}
            phoneLabel={t("manualReviewPhone")}
          />
        ) : null}

        {result && !result.verified && !result.manualReview ? (
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
                {!result.duplicate && !result.mismatch?.length ? (
                  <li>
                    {failureText(result.reason, {
                      unreadable: t("unreadable"),
                      systemError: t("systemError"),
                      genericRejected: t("genericRejected"),
                    })}
                  </li>
                ) : null}
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

      {/* Cancel-order CTA used to sit right here (big red card under
          QR) — moved out to the very bottom of the page to prevent
          mis-taps while buyers are dealing with the slip upload.
          Mounted via <CancelOrderSection /> in app/[locale]/o/[token]
          (911korn 2026-05-27 "ย้ายปุ่มยกเลิก Order ไปไว้ล่างสุด
          ป้องกันกดผิด"). */}
    </div>
  );
}

function ManualReviewNotice({
  contact,
  title,
  description,
  lineLabel,
  phoneLabel,
}: {
  contact?: ShopContact;
  title: string;
  description: string;
  lineLabel: string;
  phoneLabel: string;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-bold">{title}</p>
          <p className="mt-1 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {contact?.lineUrl || contact?.phoneUrl ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {contact.lineUrl ? (
            <a
              href={contact.lineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#06C755] px-4 text-sm font-bold text-white shadow-sm transition active:scale-[0.99]"
            >
              <MessageCircle className="size-4" />
              {lineLabel}
            </a>
          ) : null}
          {contact.phoneUrl ? (
            <a
              href={contact.phoneUrl}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-zinc-800 ring-1 ring-amber-200 transition active:scale-[0.99]"
            >
              <Phone className="size-4" />
              {phoneLabel} {contact.phone}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function maskTail(id: string) {
  const digits = id.replace(/\D/g, "");
  if (digits.length < 4) return digits;
  return "xxx-x-x" + digits.slice(-4);
}

async function readQrPayloadFromImage(dataUrl: string): Promise<string | null> {
  if (typeof document === "undefined") return null;

  try {
    const img = await loadImage(dataUrl);
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, width, height);

    // Bank slips usually place the verification QR on the right side of the
    // lower half. Keep client-side scanning cheap; the server has a full fallback.
    const regions = [
      {
        x: Math.round(width * 0.45),
        y: Math.round(height * 0.45),
        width: Math.round(width * 0.55),
        height: Math.round(height * 0.38),
      },
      {
        x: Math.round(width * 0.25),
        y: Math.round(height * 0.35),
        width: Math.round(width * 0.75),
        height: Math.round(height * 0.5),
      },
    ];

    for (const region of regions) {
      const payload = scanQr(ctx, region.x, region.y, region.width, region.height);
      if (payload) return payload;
    }
    return null;
  } catch {
    return null;
  }
}

function scanQr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageData = ctx.getImageData(x, y, width, height);
  const code = jsQR(imageData.data, width, height, {
    inversionAttempts: "dontInvert",
  });
  return code?.data?.trim() || null;
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read slip image"));
    img.src = dataUrl;
  });
}

function failureText(
  reason: string | undefined,
  copy: { unreadable: string; systemError: string; genericRejected: string },
) {
  switch (reason) {
    case "provider_rejected":
    case "receiver_unreadable":
      return copy.unreadable;
    case "provider_error":
      return copy.systemError;
    default:
      return copy.genericRejected;
  }
}
