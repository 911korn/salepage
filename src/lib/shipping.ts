export const SHIPMENT_HANDOFFS = ["DROPOFF", "PICKUP"] as const;

export type ShipmentHandoff = (typeof SHIPMENT_HANDOFFS)[number];

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
  const weight = Math.max(1, weightGram ?? 500);
  const extraSteps = Math.max(0, Math.ceil((weight - 1000) / 500));
  return courier.minFeeSatang + extraSteps * 1000;
}

export function formatHandoffLabel(handoff: string | null | undefined) {
  return handoff === "PICKUP" ? "เรียกรับพัสดุ" : "นำไปฝากส่ง";
}
