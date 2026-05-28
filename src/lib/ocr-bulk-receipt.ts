import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Bulk shipping-receipt OCR via Claude Sonnet 4.5 vision.
 *
 * Sellers who ship dozens of orders per day photograph a stack of
 * courier drop-off receipts (or one long continuous strip from the
 * counter printer). Each photo can contain 1..N receipts. We extract
 * every {trackingNumber, receiverName?, postcode?, phone?, courier}
 * tuple visible on the image so the caller can fan them out and
 * match each against a PAID order with no tracking yet.
 *
 * 911korn 2026-05-28 "เคสที่ Seller ส่งเยอะๆ แล้วมีชื่อผู้รับหลาย Order
 * ... ใน 1 วัน ส่ง 100 Order มันควรที่จะฉลาดพอในการอ่านทั้งหมดแล้วนำไป
 * Update ให้กับทุก Order ที่ Paid แล้ว อัติโนมัติทั้งหมด".
 *
 * Cost: Sonnet 4.5 vision @ ~$3/MTok input, an image runs ~1k tokens →
 * ~$0.003 per photo. 20 photos per batch = $0.06. Worth it — sellers
 * gate this behind Business+ and the saved labour is enormous.
 */

export interface BulkReceiptEntry {
  /** Tracking number — stripped of spaces/dashes. */
  trackingNumber: string;
  /** Recipient name if printed (Thailand Post eCo-Post leaves it blank). */
  receiverName: string | null;
  /** 5-digit Thai postcode if printed on the receipt (e.g., "TH 20130" → "20130"). */
  postcode: string | null;
  /** Recipient phone last-4 if printed. */
  phoneTail: string | null;
  /** Courier brand. */
  courier:
    | "FLASH"
    | "KERRY"
    | "JT"
    | "THAIPOST"
    | "SCG"
    | "BEST"
    | "NINJAVAN"
    | "DHL"
    | "OTHER"
    | null;
  /** Confidence in this single extraction — "low" should flag for review. */
  confidence: "high" | "medium" | "low";
  /** 1-indexed position of this receipt within the source photo. Lets the
   *  UI tell the seller "receipt #3 of 5 in this photo" when they confirm. */
  indexInPhoto: number;
  /** Optional normalised bbox [x1,y1,x2,y2] in 0..1 space. Claude vision's
   *  bbox accuracy is uneven, so the UI should still pad ~10% on each side
   *  when cropping. Null means "couldn't get coords; show the whole photo." */
  bbox: [number, number, number, number] | null;
  /** When the seller photographs the receipt next to OUR printed shipping
   *  label, Claude OCRs the SalePage `orderRef` (e.g. "#20260527-AB1Y2")
   *  or the public token URL ("salepage.in.th/o/<token>") from the label
   *  in the same frame. Either field gives us a 100% confident pairing
   *  that bypasses the name/postcode scoring entirely. Phase 2b for
   *  Thailand Post receipts that don't print recipient names. */
  salepageOrderRef: string | null;
  salepagePublicToken: string | null;
}

export interface BulkReceiptScanResult {
  receipts: BulkReceiptEntry[];
  /** Plain-language note about anything weird (image blurry, wrong type, etc.) */
  note: string | null;
}

const SYSTEM_PROMPT = `You are an OCR specialist for Thai courier drop-off receipts. A single image may contain one receipt OR multiple receipts side-by-side / stacked vertically — sellers often photograph 3–6 separate slips together to save time.

For EVERY visible receipt in the image, extract:
  - trackingNumber: long alphanumeric/numeric code (strip spaces + dashes; never use a phone number as fallback)
  - receiverName: Thai name of recipient if printed (Thailand Post eCo-Post + J&T economy do NOT print recipient names — return null in those cases, do not invent)
  - postcode: 5-digit Thai postcode if printed (e.g., "TH 20130", "เชียงใหม่ 50000" → "20130" / "50000")
  - phoneTail: last 4 digits of recipient phone if printed
  - courier: FLASH | KERRY | JT | THAIPOST | SCG | BEST | NINJAVAN | DHL | OTHER (read from logo / header / branding)
  - confidence: "high" / "medium" / "low" — low when text is partially blurred, glare-affected, or you're guessing
  - indexInPhoto: 1-indexed reading order (top-to-bottom, left-to-right)
  - bbox: approximate normalised bounding box [x1, y1, x2, y2] in 0..1 of the receipt's region on the image — best-effort, the caller pads for safety

ALSO look for a SalePage shipping label printed by the seller in the SAME image — sellers sometimes photograph receipt + label together so the AI can pair them. A SalePage label has:
  - The SalePage wordmark at the top.
  - An "Order" code in the format "#YYYYMMDD-AAAAA" (e.g. "#20260527-AB1Y2"). The 5-character suffix is uppercase letters/digits.
  - A QR code with text underneath reading "salepage.in.th/o/<token>" where the token is ~22 random alphanumeric characters.

If you find a SalePage label, attach its orderRef and publicToken to the receipt(s) it visually belongs to (typically the closest receipt). Use:
  - salepageOrderRef: the literal "#YYYYMMDD-AAAAA" string if visible
  - salepagePublicToken: the literal token string after "salepage.in.th/o/" if readable
If no SalePage label is in the image, set both fields to null on every receipt.

Return ONLY strict JSON — no markdown fence, no prose:
{
  "receipts": [
    {
      "trackingNumber": "...",
      "receiverName": "...",
      "postcode": "...",
      "phoneTail": "...",
      "courier": "...",
      "confidence": "...",
      "indexInPhoto": 1,
      "bbox": [0.05, 0.10, 0.95, 0.40],
      "salepageOrderRef": "#20260527-AB1Y2" or null,
      "salepagePublicToken": "zMsbJ3o7452nePa3vmlYyQ" or null
    },
    ...
  ],
  "note": null
}

Rules:
- If the image is not a courier receipt at all, return receipts:[] with a one-sentence note.
- Never duplicate the same tracking number — if a receipt repeats text inside its own area, dedupe.
- Sort by indexInPhoto (top-to-bottom).
- If you genuinely cannot read a tracking number on a receipt, omit that receipt — do not return a placeholder.
- A SalePage label without its companion receipt should NOT generate a receipt entry — labels alone aren't shipping events.`;

/** Run the OCR on a single base64 photo. Never throws — on transport
 *  failure returns receipts:[] + a note so the caller can show the
 *  seller a clear "this photo couldn't be processed" error. */
export async function scanBulkShippingReceipt(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
): Promise<BulkReceiptScanResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { receipts: [], note: "ANTHROPIC_API_KEY not configured" };
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
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
              text: "Extract every receipt visible in this photo. Return strict JSON only.",
            },
          ],
        },
      ],
    });

    const block = response.content[0];
    if (!block || block.type !== "text") {
      return { receipts: [], note: "non_text_response" };
    }
    const text = block.text.trim();
    const jsonText = stripCodeFence(text);
    const parsed = safeParse(jsonText);
    if (!parsed || !Array.isArray(parsed.receipts)) {
      return {
        receipts: [],
        note: `parse_failed: ${text.slice(0, 80)}`,
      };
    }

    const receipts: BulkReceiptEntry[] = [];
    for (const raw of parsed.receipts) {
      if (!isObject(raw)) continue;
      const trackingNumber = stringOrNull(raw.trackingNumber)
        ?.replace(/[\s-]+/g, "")
        .toUpperCase();
      if (!trackingNumber) continue;
      receipts.push({
        trackingNumber,
        receiverName: stringOrNull(raw.receiverName),
        postcode: postcodeOrNull(raw.postcode),
        phoneTail: phoneTailOrNull(raw.phoneTail),
        courier: courierOrNull(raw.courier),
        confidence: confidenceOrLow(raw.confidence),
        indexInPhoto:
          typeof raw.indexInPhoto === "number" && raw.indexInPhoto > 0
            ? Math.floor(raw.indexInPhoto)
            : receipts.length + 1,
        bbox: bboxOrNull(raw.bbox),
        salepageOrderRef: salepageOrderRefOrNull(raw.salepageOrderRef),
        salepagePublicToken: salepagePublicTokenOrNull(
          raw.salepagePublicToken,
        ),
      });
    }
    receipts.sort((a, b) => a.indexInPhoto - b.indexInPhoto);

    return {
      receipts,
      note: stringOrNull((parsed as Record<string, unknown>).note),
    };
  } catch (err) {
    console.warn("[bulk-receipt-ocr] Claude vision failed:", err);
    return {
      receipts: [],
      note: err instanceof Error ? err.message : "vision_error",
    };
  }
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1].trim() : text;
}

function safeParse(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text);
    return isObject(v) ? v : null;
  } catch {
    return null;
  }
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

function postcodeOrNull(v: unknown): string | null {
  const s = stringOrNull(v);
  if (!s) return null;
  const digits = s.match(/\d{5}/);
  return digits ? digits[0] : null;
}

function phoneTailOrNull(v: unknown): string | null {
  const s = stringOrNull(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function courierOrNull(v: unknown): BulkReceiptEntry["courier"] {
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
  ] as const;
  return (known as readonly string[]).includes(upper)
    ? (upper as BulkReceiptEntry["courier"])
    : null;
}

function confidenceOrLow(v: unknown): "high" | "medium" | "low" {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}

/** "#YYYYMMDD-AAAAA" — 8 digit date + dash + 5 uppercase alphanum. */
function salepageOrderRefOrNull(v: unknown): string | null {
  const s = stringOrNull(v);
  if (!s) return null;
  const m = s.match(/#\d{8}-[A-Z0-9]{5}/i);
  return m ? m[0].toUpperCase() : null;
}

/** 18–32 chars of [A-Za-z0-9_-], matching the slug-style publicToken
 *  generator in lib/orders.ts. We accept either bare token or the full
 *  "salepage.in.th/o/<token>" URL. */
function salepagePublicTokenOrNull(v: unknown): string | null {
  const s = stringOrNull(v);
  if (!s) return null;
  const urlMatch = s.match(/salepage\.in\.th\/o\/([A-Za-z0-9_-]{16,40})/);
  if (urlMatch) return urlMatch[1];
  // Bare token form — only accept when the string is exactly the token
  // shape (no spaces, no extra chars) so we don't accidentally match a
  // random word that happens to look tokenish.
  if (/^[A-Za-z0-9_-]{16,40}$/.test(s)) return s;
  return null;
}

function bboxOrNull(
  v: unknown,
): [number, number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  if (!v.every((n) => typeof n === "number" && n >= 0 && n <= 1)) return null;
  const [x1, y1, x2, y2] = v as number[];
  if (x2 <= x1 || y2 <= y1) return null;
  return [x1, y1, x2, y2];
}
