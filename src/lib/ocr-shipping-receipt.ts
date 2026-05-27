import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Drop-off shipping receipt OCR via Claude Sonnet 4.6 vision.
 *
 * Seller drops a parcel at any courier (Flash/Kerry/J&T/Thai Post),
 * pays cash, gets a printed receipt with the tracking number + receiver
 * name. They snap a photo and upload it — this helper extracts the
 * relevant fields so we can auto-fill the order's `trackingNumber` and
 * flip it PAID → SHIPPING without ever touching a courier API.
 *
 * The win: tracking auto-fill works on EVERY courier in Thailand,
 * including ones that don't expose a public API. 911korn 2026-05-27
 * "ให้ ai scan และเอาไปยัดให้กับสินค้านั้นๆ ก็จบแล้ว".
 */

export interface ScannedReceipt {
  trackingNumber: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  courier: string | null;
  /** Confidence in the extraction — drives the seller-confirm UX. */
  confidence: "high" | "medium" | "low";
  /** Plain-language note from the model about ambiguity. Optional. */
  note: string | null;
}

const SYSTEM_PROMPT = `You are an OCR specialist for Thai shipping courier drop-off receipts. Sellers in Thailand drop parcels at Flash Express, Kerry Express, J&T Express, Thai Post, SCG Express, Best Express, Ninjavan, or DHL counters. Each courier has a different receipt layout, but every receipt contains:

  - a tracking number (Thai: เลขพัสดุ / Tracking / Barcode No / AWB)
  - a receiver name (Thai: ชื่อผู้รับ / ผู้รับ / To / Receiver / ถึง)
  - optionally a receiver phone (Thai: โทร / Phone / Tel)
  - the courier brand (visible from the receipt header / logo)

Extract those four fields from the image. Return ONLY a strict JSON object — no markdown fence, no prose. Fields:

{
  "trackingNumber": string | null,
  "receiverName": string | null,
  "receiverPhone": string | null,
  "courier": "FLASH" | "KERRY" | "JT" | "THAIPOST" | "SCG" | "BEST" | "NINJAVAN" | "DHL" | "OTHER" | null,
  "confidence": "high" | "medium" | "low",
  "note": string | null
}

Rules:
- Tracking number is the long alphanumeric/numeric code that the counter staff scans. NEVER use phone numbers as a tracking fallback.
- Strip spaces and dashes from trackingNumber.
- receiverName is the full Thai name. Don't translate.
- "high" confidence = receipt is clear and tracking + name are both readable. "low" = tracking number is partially obscured or you're guessing.
- If the image is not a shipping receipt, return all-null with confidence "low" and a one-sentence note explaining what you see.`;

/**
 * Scan a base64-encoded JPEG/PNG image and return the extracted fields.
 * Throws on transport error; returns nulls + low confidence on extraction
 * failure so the caller can show "ดึงเลขพัสดุไม่ออก — กรอกเองได้".
 */
export async function scanShippingReceipt(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
): Promise<ScannedReceipt> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: "Extract the four fields from this shipping receipt. Return strict JSON only.",
          },
        ],
      },
    ],
  });

  const block = response.content[0];
  if (!block || block.type !== "text") {
    return emptyResult("Model returned a non-text response");
  }

  const text = block.text.trim();
  const jsonText = stripCodeFence(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return emptyResult(`Could not parse model output: ${text.slice(0, 80)}`);
  }
  if (!isObject(parsed)) return emptyResult("Model output was not an object");

  return {
    trackingNumber: stringOrNull(parsed.trackingNumber),
    receiverName: stringOrNull(parsed.receiverName),
    receiverPhone: stringOrNull(parsed.receiverPhone),
    courier: courierOrNull(parsed.courier),
    confidence: confidenceOrLow(parsed.confidence),
    note: stringOrNull(parsed.note),
  };
}

/**
 * Loose name match for the verify step. We can't trust the OCR to spell
 * the buyer's name exactly the way they typed it at checkout — Thai
 * names sometimes get re-romanised at the counter, and middle names get
 * dropped. So we normalise both sides and accept any substring overlap
 * of >= 60% on the shorter string's length.
 */
export function namesLooselyMatch(a: string, b: string): boolean {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = shorter === na ? nb : na;
  const required = Math.max(3, Math.floor(shorter.length * 0.6));
  for (let i = 0; i <= shorter.length - required; i++) {
    const slice = shorter.slice(i, i + required);
    if (longer.includes(slice)) return true;
  }
  return false;
}

function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s​‌‍]/g, "")
    .replace(/[฀-๿]/g, (c) => c)
    .replace(/[^a-z0-9฀-๿]/g, "");
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1].trim() : text;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length === 0 || trimmed.toLowerCase() === "null"
    ? null
    : trimmed;
}

function courierOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const upper = v.trim().toUpperCase();
  const known = [
    "FLASH",
    "KERRY",
    "JT",
    "THAIPOST",
    "SCG",
    "BEST",
    "NINJAVAN",
    "DHL",
    "OTHER",
  ];
  return known.includes(upper) ? upper : null;
}

function confidenceOrLow(v: unknown): "high" | "medium" | "low" {
  if (v === "high" || v === "medium" || v === "low") return v;
  return "low";
}

function emptyResult(note: string): ScannedReceipt {
  return {
    trackingNumber: null,
    receiverName: null,
    receiverPhone: null,
    courier: null,
    confidence: "low",
    note,
  };
}
