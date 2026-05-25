"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  CheckCircle2,
  ClipboardList,
  MapPin,
  PackageCheck,
  Printer,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  COURIER_OPTIONS,
  DEFAULT_PARCEL_SIZE_TEXT,
  DEFAULT_PARCEL_WEIGHT_GRAM,
  estimateShippingFeeSatang,
  formatParcelWeight,
  formatShippingFeeBaht,
  normalizeParcelWeightGram,
} from "@/lib/shipping";
import { useRouter } from "@/i18n/navigation";

type OrderStatus =
  | "PENDING"
  | "PAID"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

interface ShipmentSnapshot {
  courierCode: string;
  courierName: string;
  serviceName: string | null;
  handoff: string;
  status: string;
  trackingNumber: string | null;
  senderName: string | null;
  senderPhone: string | null;
  senderAddress: string | null;
  senderPostcode: string | null;
  receiverName: string;
  receiverPhone: string | null;
  receiverAddress: string | null;
  receiverPostcode: string | null;
  parcelWeightGram: number | null;
  parcelWidthCm: number | null;
  parcelLengthCm: number | null;
  parcelHeightCm: number | null;
  shippingFeeSatang: number | null;
  note: string | null;
}

interface Props {
  token: string;
  currentStatus: OrderStatus;
  orderRef: string;
  shopName: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  trackingNumber: string | null;
  shipment: ShipmentSnapshot | null;
}

const PACKAGE_PRESETS = [
  { label: "ซอง/ชิ้นเล็ก", weight: 500, size: "20x15x5" },
  { label: "กล่องมาตรฐาน", weight: 1000, size: "30x20x10" },
  { label: "กล่องใหญ่", weight: 2000, size: "40x30x20" },
] as const;

function satangToInputBaht(feeSatang: number | null | undefined) {
  if (feeSatang === null || feeSatang === undefined) return "";
  return String(Math.round(feeSatang / 100));
}

export function ShippingWorkflow({
  token,
  currentStatus,
  orderRef,
  shopName,
  customerName,
  customerPhone,
  customerAddress,
  trackingNumber,
  shipment,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [courierCode, setCourierCode] = useState(
    shipment?.courierCode ?? COURIER_OPTIONS[0].code,
  );
  const [handoff, setHandoff] = useState<"DROPOFF" | "PICKUP">(
    shipment?.handoff === "PICKUP" ? "PICKUP" : "DROPOFF",
  );
  const [tracking, setTracking] = useState(
    shipment?.trackingNumber ?? trackingNumber ?? "",
  );
  const [weightKg, setWeightKg] = useState(
    gramToKgInput(shipment?.parcelWeightGram ?? DEFAULT_PARCEL_WEIGHT_GRAM),
  );
  const [sizeText, setSizeText] = useState(
    shipment?.parcelLengthCm && shipment.parcelWidthCm && shipment.parcelHeightCm
      ? `${shipment.parcelLengthCm}x${shipment.parcelWidthCm}x${shipment.parcelHeightCm}`
      : DEFAULT_PARCEL_SIZE_TEXT,
  );
  const [shippingFeeBaht, setShippingFeeBaht] = useState(
    satangToInputBaht(shipment?.shippingFeeSatang),
  );
  const [feeTouched, setFeeTouched] = useState(Boolean(shipment?.shippingFeeSatang));
  const [senderName, setSenderName] = useState(shipment?.senderName ?? shopName);
  const [senderPhone, setSenderPhone] = useState(shipment?.senderPhone ?? "");
  const [senderAddress, setSenderAddress] = useState(shipment?.senderAddress ?? "");
  const [receiverAddress, setReceiverAddress] = useState(
    shipment?.receiverAddress ?? customerAddress ?? "",
  );
  const [note, setNote] = useState(shipment?.note ?? "");

  const courier = useMemo(
    () => COURIER_OPTIONS.find((option) => option.code === courierCode) ?? COURIER_OPTIONS[0],
    [courierCode],
  );
  const normalizedWeightGram = kgInputToGram(weightKg);
  const estimatedFee = estimateShippingFeeSatang(courierCode, normalizedWeightGram);
  const shippingFeeSatang = feeTouched
    ? bahtInputToSatang(shippingFeeBaht)
    : estimatedFee;
  const [lengthCm, widthCm, heightCm] = parseSize(sizeText);
  const canWork =
    currentStatus === "PAID" ||
    currentStatus === "SHIPPING" ||
    currentStatus === "DELIVERED";
  const canStartShipping = currentStatus === "PAID" || currentStatus === "SHIPPING";

  async function save(markShipping: boolean) {
    if (markShipping && !tracking.trim()) {
      toast.error("กรุณาใส่เลขพัสดุก่อนเริ่มจัดส่ง");
      return;
    }
    if (!receiverAddress.trim()) {
      toast.error("กรุณาใส่ที่อยู่ผู้รับ");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/orders/${token}/shipment`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            courierCode,
            courierName: courier.name,
            serviceName: courier.serviceName,
            handoff,
            trackingNumber: tracking.trim() || null,
            senderName: senderName.trim() || shopName,
            senderPhone: senderPhone.trim() || null,
            senderAddress: senderAddress.trim() || null,
            receiverName: customerName,
            receiverPhone: customerPhone,
            receiverAddress: receiverAddress.trim(),
            parcelWeightGram: normalizedWeightGram,
            parcelLengthCm: lengthCm,
            parcelWidthCm: widthCm,
            parcelHeightCm: heightCm,
            shippingFeeSatang,
            note: note.trim() || null,
            markShipping,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error("บันทึกขนส่งไม่สำเร็จ", {
            description: json.error?.message,
          });
          return;
        }
        toast.success(markShipping ? "เริ่มจัดส่งแล้ว" : "บันทึกข้อมูลจัดส่งแล้ว");
        router.refresh();
      } catch (e) {
        toast.error("บันทึกขนส่งไม่สำเร็จ", {
          description: e instanceof Error ? e.message : "network error",
        });
      }
    });
  }

  return (
    <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Auto Shipping</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
            เตรียมพัสดุ เลือกขนส่ง พิมพ์ใบปะหน้า และแจ้งเลขให้ลูกค้าในจอเดียว
          </p>
        </div>
        <span className="rounded-full bg-[color:var(--color-brand-50)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-brand-700)]">
          Pro+
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5 text-center text-[10px] font-semibold text-zinc-500">
        <Step active done label="จ่ายแล้ว" icon={<CheckCircle2 className="size-3.5" />} />
        <Step
          active={canWork}
          done={Boolean(shipment)}
          label="แพ็ก"
          icon={<PackageCheck className="size-3.5" />}
        />
        <Step
          active={Boolean(shipment)}
          done={Boolean(shipment)}
          label="ใบปะหน้า"
          icon={<Printer className="size-3.5" />}
        />
        <Step
          active={currentStatus === "SHIPPING" || currentStatus === "DELIVERED"}
          done={currentStatus === "DELIVERED"}
          label="ส่งแล้ว"
          icon={<Truck className="size-3.5" />}
        />
      </div>

      {!canWork ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-800">
          รอลูกค้าชำระเงินก่อน แล้วค่อยเริ่มจัดส่ง
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold">เลือกขนส่ง</label>
          <div className="grid grid-cols-2 gap-2">
            {COURIER_OPTIONS.map((option) => (
              <button
                key={option.code}
                type="button"
                disabled={!canWork || pending}
                onClick={() => setCourierCode(option.code)}
                className={cn(
                  "min-h-14 rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99] disabled:opacity-50",
                  courierCode === option.code
                    ? "border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)]"
                    : "border-[color:var(--color-border)] bg-white",
                )}
              >
                <span className="block text-[13px] font-semibold text-zinc-900">
                  {option.name}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {option.serviceName}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "DROPOFF", label: "นำไปฝากส่ง" },
            { value: "PICKUP", label: "เรียกรับ" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              disabled={!canWork || pending}
              onClick={() => setHandoff(item.value as "DROPOFF" | "PICKUP")}
              className={cn(
                "min-h-11 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50",
                handoff === item.value
                  ? "border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-800)]"
                  : "border-[color:var(--color-border)] bg-white text-zinc-700",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">ขนาดพัสดุ</label>
          <div className="grid gap-2 sm:grid-cols-3">
            {PACKAGE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={!canWork || pending}
                onClick={() => {
                  setWeightKg(gramToKgInput(preset.weight));
                  setSizeText(preset.size);
                  if (!feeTouched) setShippingFeeBaht("");
                }}
                className="min-h-12 rounded-xl border border-[color:var(--color-border)] bg-white px-3 text-left text-[12px] disabled:opacity-50"
              >
                <span className="block font-semibold text-zinc-800">
                  {preset.label}
                </span>
                <span className="text-zinc-500">
                  {formatParcelWeight(preset.weight)} · {preset.size}cm
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input
              value={weightKg}
              onChange={(e) => {
                const next = e.target.value.replace(/[^\d.]/g, "");
                setWeightKg(next);
                if (!feeTouched) setShippingFeeBaht("");
              }}
              onBlur={() => setWeightKg(gramToKgInput(normalizedWeightGram))}
              inputMode="decimal"
              disabled={!canWork || pending}
              placeholder="น้ำหนัก (กก.)"
              maxLength={5}
            />
            <Input
              value={sizeText}
              onChange={(e) => setSizeText(e.target.value.replace(/[^0-9xX]/g, ""))}
              disabled={!canWork || pending}
              placeholder="ยxกxส cm"
            />
          </div>
          <div className="mt-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-soft)] p-3">
            <div className="flex items-start justify-between gap-3 text-[12px]">
              <div>
                <p className="font-semibold text-zinc-800">เรทแนะนำ</p>
                <p className="mt-0.5 text-zinc-500">
                  {courier.code === "other"
                    ? "ขนส่งอื่นไม่มีเรทอัตโนมัติ"
                    : `${courier.name} · ${formatParcelWeight(normalizedWeightGram)}`}
                </p>
              </div>
              <p className="shrink-0 text-base font-black text-[color:var(--color-brand-700)]">
                {formatShippingFeeBaht(estimatedFee)}
              </p>
            </div>
            <label className="mt-3 block text-[12px] font-semibold text-zinc-700">
              ค่าส่งที่จะบันทึก (บาท)
            </label>
            <Input
              value={feeTouched ? shippingFeeBaht : satangToInputBaht(estimatedFee)}
              onChange={(e) => {
                setFeeTouched(true);
                setShippingFeeBaht(e.target.value.replace(/[^\d]/g, "").slice(0, 4));
              }}
              disabled={!canWork || pending}
              inputMode="numeric"
              placeholder={estimatedFee ? satangToInputBaht(estimatedFee) : "ใส่เอง"}
              className="mt-1 bg-white"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
              ระบบนี้ยังเป็น manual shipping: เรทแนะนำใช้ช่วยตัดสินใจเท่านั้น
              ร้านแก้ค่าส่งจริงก่อนบันทึกได้
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-[color:var(--color-soft)] p-3">
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="size-4 text-[color:var(--color-brand-600)]" />
            ผู้รับ
          </p>
          <p className="text-[13px] font-semibold">{customerName}</p>
          {customerPhone ? <p className="text-[12px] text-zinc-500">{customerPhone}</p> : null}
          <textarea
            value={receiverAddress}
            onChange={(e) => setReceiverAddress(e.target.value)}
            disabled={!canWork || pending}
            rows={3}
            className="mt-2 w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[13px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)] disabled:opacity-50"
            placeholder="ที่อยู่ผู้รับ"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-semibold">เลขพัสดุ</label>
          <Input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            disabled={!canWork || pending}
            placeholder="เช่น TH123456789"
          />
        </div>

        <details className="rounded-2xl border border-[color:var(--color-border)] bg-white">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-semibold">
            <ClipboardList className="size-4 text-[color:var(--color-brand-600)]" />
            ข้อมูลร้านผู้ส่ง
          </summary>
          <div className="space-y-2 border-t border-[color:var(--color-border)] p-3">
            <Input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              disabled={!canWork || pending}
              placeholder="ชื่อผู้ส่ง"
            />
            <Input
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              disabled={!canWork || pending}
              placeholder="เบอร์ผู้ส่ง"
              inputMode="tel"
            />
            <textarea
              value={senderAddress}
              onChange={(e) => setSenderAddress(e.target.value)}
              disabled={!canWork || pending}
              rows={2}
              className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[13px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)] disabled:opacity-50"
              placeholder="ที่อยู่ผู้ส่ง"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!canWork || pending}
              rows={2}
              className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[13px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)] disabled:opacity-50"
              placeholder="โน้ตจัดส่ง เช่น ระวังแตก"
            />
          </div>
        </details>
      </div>

      <div className="mt-5 grid gap-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          className="w-full"
          loading={pending}
          disabled={!canWork || pending}
          onClick={() => save(false)}
        >
          บันทึกข้อมูลจัดส่ง
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/dashboard/orders/${token}/label`}
            target="_blank"
            className={cn(
              "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-white text-[15px] font-medium text-[color:var(--color-fg)] transition hover:bg-[color:var(--color-soft)]",
              !shipment && "pointer-events-none opacity-50",
            )}
          >
            <Printer className="size-4" /> พิมพ์ใบปะหน้า
          </Link>
          <Button
            type="button"
            size="md"
            loading={pending}
            disabled={!canStartShipping || pending}
            onClick={() => save(true)}
          >
            <Truck className="size-4" /> เริ่มส่ง
          </Button>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-zinc-400">{orderRef}</p>
    </section>
  );
}

function Step({
  active,
  done,
  icon,
  label,
}: {
  active: boolean;
  done: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-1.5 py-2",
        active ? "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]" : "bg-zinc-100",
        done && "ring-1 ring-[color:var(--color-brand-200)]",
      )}
    >
      <span className="mx-auto mb-1 grid size-6 place-items-center rounded-full bg-white">
        {icon}
      </span>
      {label}
    </div>
  );
}

function parseSize(value: string) {
  const parts = value
    .toLowerCase()
    .split("x")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part) && part > 0);
  return [parts[0] ?? null, parts[1] ?? null, parts[2] ?? null] as const;
}

function bahtInputToSatang(value: string) {
  const baht = Number(value.replace(/[^\d]/g, ""));
  if (!Number.isFinite(baht) || baht <= 0) return null;
  return Math.min(1000, Math.round(baht)) * 100;
}

function kgInputToGram(value: string) {
  const kg = Number(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(kg) || kg <= 0) return DEFAULT_PARCEL_WEIGHT_GRAM;
  return normalizeParcelWeightGram(Math.round(kg * 1000));
}

function gramToKgInput(weightGram: number | null | undefined) {
  const kg = normalizeParcelWeightGram(weightGram) / 1000;
  return kg.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: kg < 1 ? 1 : 0,
  });
}
