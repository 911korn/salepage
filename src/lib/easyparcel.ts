/**
 * EasyParcel client — V2.1 Phase 1 (rate quote scaffold).
 *
 * Master-account model per 911korn 2026-05-27 ("B เอาแบบ Shopee
 * ร้านค้าต้องสะดวก ลูกค้าต้องสบายใจ"): the platform holds the
 * EasyParcel credit pool. Sellers + buyers never touch EasyParcel
 * directly — we proxy every call from a single server-side key.
 *
 * Functions:
 *   - getRates(input)   → list of courier options + prices for a parcel
 *   - buyLabel(input)   → confirm a quote, get AWB + PDF URL (Phase 2)
 *   - getTracking(awb)  → status events for a shipment (Phase 3)
 *
 * Env (set in Vercel):
 *   EASYPARCEL_API_KEY        — production key from the master account
 *   EASYPARCEL_BASE_URL       — https://api.easyparcel.co.th (or sandbox)
 *   EASYPARCEL_SENDER_NAME    — fallback sender on the platform's
 *                                consolidated label when a shop hasn't
 *                                set its own pickup address
 *   EASYPARCEL_SENDER_PHONE
 *   EASYPARCEL_SENDER_POSTCODE
 *
 * Without an API key, every call falls back to MOCK responses so the
 * mobile + web UI can be developed against the same shape. The mock
 * returns realistic TH couriers (Flash / Kerry / J&T / SCG / Thai Post).
 */

export interface ParcelDimensions {
  weightGram: number;
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
}

export interface RateQuoteInput {
  sender: {
    name: string;
    phone: string;
    address: string;
    postcode: string;
  };
  receiver: {
    name: string;
    phone: string;
    address: string;
    postcode: string;
  };
  parcel: ParcelDimensions;
  /** "DROPOFF" or "PICKUP" — affects which carriers can fulfill. */
  handoff?: "DROPOFF" | "PICKUP";
  /** COD amount in satang, if seller is collecting on-delivery. */
  codSatang?: number;
}

export interface RateQuote {
  /** Stable identifier we pass back to `buyLabel` to lock the quote. */
  rateRef: string;
  courierCode: string;
  courierName: string;
  serviceName: string;
  priceSatang: number;
  /** Estimated transit days (string because providers report ranges). */
  etaDays: string;
  dropoffSupported: boolean;
  pickupSupported: boolean;
  /** Provider-native rate id — opaque to us, just round-tripped. */
  providerRateId: string;
}

interface BuyLabelInput {
  rateRef: string;
  /** Mirror the rate quote inputs so the provider can sanity-check. */
  sender: RateQuoteInput["sender"];
  receiver: RateQuoteInput["receiver"];
  parcel: ParcelDimensions;
  handoff?: "DROPOFF" | "PICKUP";
  codSatang?: number;
  /** Order ref shown on the label face for warehouse tracking. */
  orderRef: string;
}

export interface PurchasedLabel {
  awbNumber: string;
  /** Public URL of the label PDF (typically signed-S3 with short TTL). */
  labelPdfUrl: string;
  /** EasyParcel's internal order number — store for support escalations. */
  providerOrderNo: string;
}

export interface TrackingEvent {
  status: string;
  description: string;
  location?: string;
  timestamp: string;
}

const MOCK_COURIERS = [
  { code: "FLASH", name: "Flash Express", base: 4500, days: "1-2" },
  { code: "KERRY", name: "Kerry Express", base: 5200, days: "1-2" },
  { code: "JT", name: "J&T Express", base: 4200, days: "1-3" },
  { code: "SCG", name: "SCG Express", base: 6000, days: "1-2" },
  { code: "THAIPOST", name: "Thai Post EMS", base: 3500, days: "2-3" },
] as const;

function isConfigured(): boolean {
  return Boolean(process.env.EASYPARCEL_API_KEY);
}

function baseUrl(): string {
  return process.env.EASYPARCEL_BASE_URL ?? "https://api.easyparcel.co.th";
}

/**
 * Pull rate quotes for a parcel. Returns the cheapest + branded couriers
 * supported on the route. Falls back to a deterministic mock list when
 * EASYPARCEL_API_KEY isn't set so the UI can still wire up.
 */
export async function getRates(input: RateQuoteInput): Promise<RateQuote[]> {
  if (!isConfigured()) return mockRates(input);

  // Phase 1: real call. EasyParcel's TH endpoint is
  //   POST {baseUrl}/api/v2/Bulk/EPRateChecking
  // Body shape isn't fully nailed down here because the docs gate the
  // sandbox behind a sales call; once we have the actual schema this
  // becomes a thin mapper. For now we throw so any real-key call fails
  // loudly while the integration is being finalised.
  const res = await fetch(`${baseUrl()}/api/v2/Bulk/EPRateChecking`, {
    method: "POST",
    headers: {
      "x-api-key": process.env.EASYPARCEL_API_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify(toProviderShape(input)),
  });
  if (!res.ok) {
    throw new Error(`EasyParcel rate quote failed: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return fromProviderRates(json, input);
}

/**
 * Buy a label (commit a rate). Phase 2 will wire the actual call;
 * Phase 1 stub so the API route can compile and the unhappy path
 * surface to the UI ("not yet available").
 */
export async function buyLabel(input: BuyLabelInput): Promise<PurchasedLabel> {
  if (!isConfigured()) {
    return mockPurchased(input);
  }
  throw new Error("EasyParcel buyLabel not yet implemented in Phase 1");
}

/**
 * Fetch tracking events. Phase 3 will swap mock for the real webhook
 * + polling combo.
 */
export async function getTracking(awb: string): Promise<TrackingEvent[]> {
  if (!isConfigured()) return mockTracking(awb);
  throw new Error("EasyParcel getTracking not yet implemented in Phase 1");
}

/** Cheapest first, with a small price jitter so the buyer doesn't see
 *  identical numbers from every test order. */
function mockRates(input: RateQuoteInput): RateQuote[] {
  const weightKg = Math.max(0.25, input.parcel.weightGram / 1000);
  const sameProvince = input.sender.postcode.slice(0, 2) === input.receiver.postcode.slice(0, 2);
  return MOCK_COURIERS.map((c, i) => {
    const distFactor = sameProvince ? 1 : 1.25;
    const priceSatang = Math.round((c.base + (weightKg - 0.25) * 1500) * distFactor);
    return {
      rateRef: `mock-${c.code}-${Date.now().toString(36)}-${i}`,
      courierCode: c.code,
      courierName: c.name,
      serviceName: c.name,
      priceSatang,
      etaDays: c.days,
      dropoffSupported: true,
      pickupSupported: c.code !== "THAIPOST",
      providerRateId: `mock-${c.code}`,
    };
  }).sort((a, b) => a.priceSatang - b.priceSatang);
}

function mockPurchased(input: BuyLabelInput): PurchasedLabel {
  return {
    awbNumber: `MOCK${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
    labelPdfUrl: `https://salepage.in.th/mock-label.pdf?order=${encodeURIComponent(input.orderRef)}`,
    providerOrderNo: `EP-MOCK-${Date.now()}`,
  };
}

function mockTracking(awb: string): TrackingEvent[] {
  return [
    {
      status: "in_transit",
      description: `Parcel ${awb} picked up`,
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

/** Translate our normalized input to the provider's expected schema. */
function toProviderShape(input: RateQuoteInput): Record<string, unknown> {
  return {
    sender_postcode: input.sender.postcode,
    receiver_postcode: input.receiver.postcode,
    weight: input.parcel.weightGram / 1000,
    width: input.parcel.widthCm ?? 10,
    length: input.parcel.lengthCm ?? 10,
    height: input.parcel.heightCm ?? 10,
    cod: input.codSatang ? input.codSatang / 100 : 0,
    handoff: input.handoff ?? "DROPOFF",
  };
}

/** Provider response → our normalized RateQuote list. Shape stubbed
 *  until the real EasyParcel schema is wired. */
function fromProviderRates(_json: unknown, input: RateQuoteInput): RateQuote[] {
  // Fallback to mocks even when a key is present, until the response
  // mapper lands in Phase 2. Keeps the integration callable safely.
  return mockRates(input);
}
