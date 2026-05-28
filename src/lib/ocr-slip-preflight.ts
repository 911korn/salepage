import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Slip pre-flight detection via Claude Haiku 4.5 vision.
 *
 * Runs BEFORE the SlipOK quota gate so a buyer who uploads a non-slip
 * image (selfie, screenshot of something else, random photo) gets
 * "รูปนี้ไม่ใช่สลิป กรุณาอัปโหลดใหม่" — instead of being routed into
 * the shop's manual-review queue. This matters most for FREE/STARTER
 * shops with zero SlipOK quota — without this pre-flight, the slip
 * route skips SlipOK entirely and the buyer never learns their image
 * was the problem.
 *
 * 911korn 2026-05-28 "ทดลองส่งรูปที่ไม่ใช่สลิป แต่มันขึ้นแบบนี้
 * ถ้าถูกต้องที่สุดมันต้องแจ้งให้อัพใหม่ สิ".
 *
 * Cost: Haiku 4.5 at ~$1/MTok input, image is ~1k tokens → ~$0.001 per
 * upload. Cheap enough to run on every slip upload regardless of shop
 * tier. We use Haiku (not Sonnet) because the question is binary —
 * "is this a transfer slip yes/no" — and Haiku is plenty for that.
 */

export interface SlipPreflightResult {
  /** True = looks like a Thai bank transfer slip. False = something else. */
  isSlip: boolean;
  /** "high" = strong signal either way · "low" = ambiguous, lean toward
   *  letting SlipOK be the judge (give the buyer benefit of the doubt). */
  confidence: "high" | "medium" | "low";
  /** Plain-language note about what the model saw — for logs only,
   *  never shown to the buyer. */
  note: string | null;
}

const SYSTEM_PROMPT = `You are a binary classifier for Thai bank transfer slip images. The user uploads an image and you decide whether it is a legitimate Thai bank-app transfer slip / e-receipt that a merchant would accept as proof of payment.

A Thai transfer slip ALWAYS shows ALL of these features (any major bank app — Kasikorn / SCB / Bangkok Bank / KrungThai / KrungSri / Bualuang / TMB / TTB / GSB / BAAC / UOB / CIMB / Citi / Standard Chartered / KTC etc.):
  - a transfer amount in Thai Baht (฿ or "บาท")
  - a transfer date+time stamp
  - sender / receiver account details (name, masked account number, bank)
  - usually a "Transfer successful" / "โอนเงินสำเร็จ" / "โอนสำเร็จ" / "ทำรายการสำเร็จ" badge
  - usually a Thai QR code (PromptPay verification QR) somewhere on the slip
  - bank branding / logo

Reject as NOT a slip if it's:
  - a photo of a person / selfie / non-receipt object
  - a screenshot of something other than a banking app (chat, web page, social media, game)
  - a product photo, food photo, animal photo, landscape
  - a clearly blurry / illegible photo with no slip-shaped layout
  - a PromptPay QR code alone (no transfer confirmation)
  - a payment request screen (not a confirmation that money was sent)

Return ONLY a strict JSON object — no markdown fence, no prose:
{
  "isSlip": true | false,
  "confidence": "high" | "medium" | "low",
  "note": "one short sentence about what you actually see"
}

Lean conservative — if you're unsure, return isSlip:true with low confidence so the downstream SlipOK provider can be the final judge. Only return isSlip:false with high/medium confidence when the image is OBVIOUSLY not a transfer slip.`;

/** Run pre-flight on a base64-encoded JPEG/PNG. Never throws. */
export async function preflightSlipImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
): Promise<SlipPreflightResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No Claude key configured — skip pre-flight, let SlipOK be the judge.
    return { isSlip: true, confidence: "low", note: "preflight_skipped" };
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
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
              text: "Is this image a Thai bank transfer slip? Return strict JSON only.",
            },
          ],
        },
      ],
    });

    const block = response.content[0];
    if (!block || block.type !== "text") {
      return { isSlip: true, confidence: "low", note: "non_text_response" };
    }

    const text = block.text.trim();
    const jsonText = stripCodeFence(text);
    const parsed = safeParse(jsonText);
    if (!parsed) {
      return {
        isSlip: true,
        confidence: "low",
        note: `parse_failed: ${text.slice(0, 80)}`,
      };
    }

    return {
      isSlip: typeof parsed.isSlip === "boolean" ? parsed.isSlip : true,
      confidence: confidenceOrLow(parsed.confidence),
      note: typeof parsed.note === "string" ? parsed.note : null,
    };
  } catch (err) {
    // Network blip or transient API error — assume it's a slip and let
    // SlipOK be the judge. We never want pre-flight to be the reason a
    // legit slip gets blocked.
    console.warn("[slip-preflight] Claude vision failed:", err);
    return {
      isSlip: true,
      confidence: "low",
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
    return typeof v === "object" && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function confidenceOrLow(v: unknown): "high" | "medium" | "low" {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}
