/**
 * Web mirror of mobile/src/lib/courier-detect.ts — keep the two in sync
 * when adding couriers. Used by the seller dashboard's ShippingReceiptCard
 * to render a "Check Status" button that opens the correct courier's
 * public tracking page based on the AI-scanned tracking number.
 */

export interface CourierMatch {
  id:
    | "thailand-post"
    | "kerry"
    | "flash"
    | "jt"
    | "lazada"
    | "ninja-van"
    | "dhl"
    | "scg"
    | "best"
    | "unknown";
  name: string;
  url: string;
}

export function detectCourier(rawTracking: string): CourierMatch {
  const t = rawTracking.trim().toUpperCase();

  if (/^[A-Z]{2}\d{9}TH$/.test(t)) {
    return {
      id: "thailand-post",
      name: "ไปรษณีย์ไทย",
      url: `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(t)}`,
    };
  }
  if (/^KEX\d{8,13}$/.test(t) || /^THRECP\d{8,}$/.test(t)) {
    return {
      id: "kerry",
      name: "Kerry Express",
      url: `https://th.kerryexpress.com/th/track/?track=${encodeURIComponent(t)}`,
    };
  }
  if (/^FLA\d+$/.test(t) || (/^TH\d{10,12}$/.test(t) && !/TH$/.test(t.slice(2)))) {
    return {
      id: "flash",
      name: "Flash Express",
      url: `https://www.flashexpress.co.th/tracking/?se=${encodeURIComponent(t)}`,
    };
  }
  if (/^JNT?\d{8,}$/.test(t) || /^JT\d{8,}$/.test(t)) {
    return {
      id: "jt",
      name: "J&T Express",
      url: `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${encodeURIComponent(t)}`,
    };
  }
  if (/^L[EZ]X\d+$/.test(t) || /^LZD\d+$/.test(t)) {
    return {
      id: "lazada",
      name: "Lazada Express",
      url: `https://lel.asia/th/track?id=${encodeURIComponent(t)}`,
    };
  }
  if (/^NV[A-Z0-9]+$/.test(t)) {
    return {
      id: "ninja-van",
      name: "Ninja Van",
      url: `https://www.ninjavan.co/th-th/tracking?id=${encodeURIComponent(t)}`,
    };
  }
  if (/^SCG\d+$/.test(t)) {
    return {
      id: "scg",
      name: "SCG Express",
      url: `https://www.scgexpress.co.th/tracking?cs=${encodeURIComponent(t)}`,
    };
  }
  if (/^BE\d+$/.test(t)) {
    return {
      id: "best",
      name: "Best Express",
      url: `https://www.best-inc.co.th/track?bills=${encodeURIComponent(t)}`,
    };
  }
  if (/^\d{10}$/.test(t)) {
    return {
      id: "dhl",
      name: "DHL Express",
      url: `https://mydhl.express.dhl/th/en/tracking.html#/track?id=${encodeURIComponent(t)}`,
    };
  }
  return {
    id: "unknown",
    name: "Tracking",
    url: `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(t)}`,
  };
}

/**
 * Prefer the AI-extracted courier from the OCR scan when available
 * (the AI sees the courier logo on the receipt directly, which is
 * more accurate than regex-on-tracking-format guessing). Fall back to
 * detectCourier() if the AI didn't return a code or the code is
 * "OTHER".
 */
export function resolveCourier(
  trackingNumber: string,
  aiCourierCode: string | null,
): CourierMatch {
  const map: Record<string, CourierMatch["id"]> = {
    FLASH: "flash",
    KERRY: "kerry",
    JT: "jt",
    THAIPOST: "thailand-post",
    SCG: "scg",
    BEST: "best",
    NINJAVAN: "ninja-van",
    DHL: "dhl",
  };
  if (aiCourierCode && map[aiCourierCode]) {
    const id = map[aiCourierCode];
    const fromRegex = detectCourier(trackingNumber);
    if (fromRegex.id === id) return fromRegex;
    // The AI's code disagrees with the regex (or the regex didn't match).
    // Build the URL from the courier's known endpoint so seller still gets
    // a working link rather than a regex fallback.
    return overrideCourierUrl(id, trackingNumber);
  }
  return detectCourier(trackingNumber);
}

function overrideCourierUrl(
  id: CourierMatch["id"],
  trackingNumber: string,
): CourierMatch {
  const enc = encodeURIComponent(trackingNumber);
  switch (id) {
    case "thailand-post":
      return { id, name: "ไปรษณีย์ไทย", url: `https://track.thailandpost.co.th/?trackNumber=${enc}` };
    case "kerry":
      return { id, name: "Kerry Express", url: `https://th.kerryexpress.com/th/track/?track=${enc}` };
    case "flash":
      return { id, name: "Flash Express", url: `https://www.flashexpress.co.th/tracking/?se=${enc}` };
    case "jt":
      return { id, name: "J&T Express", url: `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${enc}` };
    case "lazada":
      return { id, name: "Lazada Express", url: `https://lel.asia/th/track?id=${enc}` };
    case "ninja-van":
      return { id, name: "Ninja Van", url: `https://www.ninjavan.co/th-th/tracking?id=${enc}` };
    case "scg":
      return { id, name: "SCG Express", url: `https://www.scgexpress.co.th/tracking?cs=${enc}` };
    case "best":
      return { id, name: "Best Express", url: `https://www.best-inc.co.th/track?bills=${enc}` };
    case "dhl":
      return { id, name: "DHL Express", url: `https://mydhl.express.dhl/th/en/tracking.html#/track?id=${enc}` };
    default:
      return detectCourier(trackingNumber);
  }
}
