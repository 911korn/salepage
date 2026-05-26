/**
 * Detect the courier behind a Thai shipping tracking number, return a
 * display name + a public tracking-page URL that the buyer can hit in
 * the in-app WebView.
 *
 * Detection is best-effort regex against the format spec each courier
 * publishes. Tracking numbers from couriers we don't recognize fall
 * back to "Thailand Post" because that's the most permissive endpoint
 * (it accepts both EMS + parcel ids without immediately erroring).
 *
 * Sources for the patterns (verified 2026-05-27):
 *   Thailand Post: 13 chars, 2 letters + 9 digits + "TH"
 *     - EMS:        E*TH  (EX, EE, EL, EM …)
 *     - Parcel:     R*TH  (RC, RB, RE …)
 *     - Domestic:   P*TH
 *   Kerry Express: "KEX" + 9-13 digits, or "TH" + 11+ digits w/ checksum
 *   Flash Express: "TH" + 10-12 digits (no trailing TH)
 *   J&T:           starts with "JT" or "JNT" or 10 digits-only
 *   Lazada Express: "LEX" or "LZD" prefix
 *   Ninja Van:     "NV" prefix or pure-digits
 *   DHL Express:   10-digit numeric (rare in TH e-commerce)
 *   SCG Express:   "SCG" prefix
 *   Best Express:  "BE" prefix
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
  /** Display name (TH). */
  name: string;
  /** Public tracking URL with the tracking number embedded. */
  url: string;
}

export function detectCourier(rawTracking: string): CourierMatch {
  const t = rawTracking.trim().toUpperCase();

  // Thailand Post — 2 letters + 9 digits + "TH"
  if (/^[A-Z]{2}\d{9}TH$/.test(t)) {
    return {
      id: "thailand-post",
      name: "ไปรษณีย์ไทย",
      url: `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(t)}`,
    };
  }

  // Kerry Express
  if (/^KEX\d{8,13}$/.test(t) || /^THRECP\d{8,}$/.test(t)) {
    return {
      id: "kerry",
      name: "Kerry Express",
      url: `https://th.kerryexpress.com/th/track/?track=${encodeURIComponent(t)}`,
    };
  }

  // Flash Express — "TH" + 10-12 digits OR "FLA" prefix
  if (/^FLA\d+$/.test(t) || (/^TH\d{10,12}$/.test(t) && !/TH$/.test(t.slice(2)))) {
    return {
      id: "flash",
      name: "Flash Express",
      url: `https://www.flashexpress.co.th/tracking/?se=${encodeURIComponent(t)}`,
    };
  }

  // J&T Express
  if (/^JNT?\d{8,}$/.test(t) || /^JT\d{8,}$/.test(t)) {
    return {
      id: "jt",
      name: "J&T Express",
      url: `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${encodeURIComponent(t)}`,
    };
  }

  // Lazada Express
  if (/^L[EZ]X\d+$/.test(t) || /^LZD\d+$/.test(t)) {
    return {
      id: "lazada",
      name: "Lazada Express",
      url: `https://lel.asia/th/track?id=${encodeURIComponent(t)}`,
    };
  }

  // Ninja Van
  if (/^NV[A-Z0-9]+$/.test(t)) {
    return {
      id: "ninja-van",
      name: "Ninja Van",
      url: `https://www.ninjavan.co/th-th/tracking?id=${encodeURIComponent(t)}`,
    };
  }

  // SCG Express
  if (/^SCG\d+$/.test(t)) {
    return {
      id: "scg",
      name: "SCG Express",
      url: `https://www.scgexpress.co.th/tracking?cs=${encodeURIComponent(t)}`,
    };
  }

  // Best Express
  if (/^BE\d+$/.test(t)) {
    return {
      id: "best",
      name: "Best Express",
      url: `https://www.best-inc.co.th/track?bills=${encodeURIComponent(t)}`,
    };
  }

  // DHL (TH e-commerce uses pure 10-digit numerics for some flows)
  if (/^\d{10}$/.test(t)) {
    return {
      id: "dhl",
      name: "DHL Express",
      url: `https://mydhl.express.dhl/th/en/tracking.html#/track?id=${encodeURIComponent(t)}`,
    };
  }

  // Unknown shape — fall back to a Google search so the buyer can still
  // see *something* tied to their tracking number. Thailand Post's UI is
  // tolerant of arbitrary ids and shows "ไม่พบข้อมูล" rather than
  // erroring, so we use it as the visible fallback target too.
  return {
    id: "unknown",
    name: "Tracking",
    url: `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(t)}`,
  };
}
