export const SHIPMENT_HANDOFFS = ["DROPOFF", "PICKUP"] as const;

export type ShipmentHandoff = (typeof SHIPMENT_HANDOFFS)[number];

export const DEFAULT_PARCEL_WEIGHT_GRAM = 500;
export const DEFAULT_PARCEL_SIZE_TEXT = "20x15x5";
export const MAX_PARCEL_WEIGHT_GRAM = 30_000;

export const COURIER_OPTIONS = [
  {
    code: "flash",
    name: "Flash Express",
    serviceName: "ส่งด่วน",
    minFeeSatang: 2800,
    dropoffHint: "จุดฝาก Flash ใกล้บ้าน",
  },
  {
    code: "jnt",
    name: "J&T Express",
    serviceName: "ส่งด่วน",
    minFeeSatang: 3000,
    dropoffHint: "จุดฝาก J&T",
  },
  {
    code: "kerry",
    name: "Kerry Express",
    serviceName: "ส่งด่วน",
    minFeeSatang: 3500,
    dropoffHint: "สาขา Kerry",
  },
  {
    code: "thaipost",
    name: "Thailand Post",
    serviceName: "EMS/ลงทะเบียน",
    minFeeSatang: 2500,
    dropoffHint: "ไปรษณีย์ไทย",
  },
  {
    code: "ninja",
    name: "Ninja Van",
    serviceName: "ส่งด่วน",
    minFeeSatang: 3200,
    dropoffHint: "จุดฝาก Ninja Van",
  },
  {
    code: "other",
    name: "ขนส่งอื่น",
    serviceName: "Manual",
    minFeeSatang: 0,
    dropoffHint: "ตามที่ร้านเลือก",
  },
] as const;

export type CourierCode = (typeof COURIER_OPTIONS)[number]["code"];

export function getCourierOption(code: string | null | undefined) {
  return COURIER_OPTIONS.find((option) => option.code === code) ?? COURIER_OPTIONS[0];
}

export function estimateShippingFeeSatang(
  courierCode: string | null | undefined,
  weightGram: number | null | undefined,
) {
  const courier = getCourierOption(courierCode);
  if (courier.code === "other") return null;
  const weight = normalizeParcelWeightGram(weightGram);
  const extraSteps = Math.max(0, Math.ceil((weight - 1000) / 500));
  return courier.minFeeSatang + extraSteps * 1000;
}

export function formatHandoffLabel(handoff: string | null | undefined) {
  return handoff === "PICKUP" ? "เรียกรับพัสดุ" : "นำไปฝากส่ง";
}

export function normalizeParcelWeightGram(
  value: number | string | null | undefined,
) {
  const raw =
    typeof value === "string" ? Number(value.replace(/[^\d]/g, "")) : value;
  if (!Number.isFinite(raw) || !raw || raw <= 0) {
    return DEFAULT_PARCEL_WEIGHT_GRAM;
  }
  return Math.min(MAX_PARCEL_WEIGHT_GRAM, Math.max(1, Math.round(raw)));
}

export function formatParcelWeight(weightGram: number | null | undefined) {
  const weight = normalizeParcelWeightGram(weightGram);
  if (weight >= 500) {
    return `${(weight / 1000).toLocaleString("th-TH", {
      maximumFractionDigits: 1,
    })} กก.`;
  }
  return `${weight.toLocaleString("th-TH")} กรัม`;
}

export function formatShippingFeeBaht(feeSatang: number | null | undefined) {
  if (feeSatang === null || feeSatang === undefined) return "-";
  return `฿${Math.round(feeSatang / 100).toLocaleString("th-TH")}`;
}
