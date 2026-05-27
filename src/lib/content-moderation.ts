import Anthropic from "@anthropic-ai/sdk";

/**
 * Apple Guideline 1.2 — "a method for filtering objectionable content".
 *
 * Called from `/api/v1/upload` for every image upload BEFORE the blob is
 * persisted. We feed the image to Claude haiku with a strict policy
 * prompt and parse a single-line verdict. If the image is judged
 * unsafe, the upload route returns 422 with a localized message and
 * never writes anything to Vercel Blob.
 *
 * Failure modes we explicitly accept:
 * - Anthropic API down / no key → return ALLOW (fail-open) and log.
 *   Apple cares that we *have* a filter, not that the filter is the
 *   single point of failure for product uploads.
 * - Verdict doesn't parse → ALLOW + log. Same reason.
 *
 * Cost note: ~$0.0007 per image at current haiku pricing — pennies per
 * thousand uploads. Acceptable given the policy is hard-required.
 */
export type ModerationVerdict =
  | { ok: true }
  | { ok: false; reason: string };

const ANTHROPIC = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const PROMPT = `You are a content moderator for SalePage, a consumer e-commerce app.
Look at this image and decide if it is acceptable.

REJECT (output exactly: REJECT:<reason>) if the image contains:
- sexual or pornographic content, nudity, suggestive poses
- graphic violence, gore, weapons aimed at people, gory injuries
- illegal goods (drugs, weapons, ivory, endangered wildlife, counterfeit currency)
- hate symbols, terrorist insignia, racial slurs displayed as text in the image
- screenshots clearly showing private personal data of identifiable third parties (ID cards, passports, bank statements with names)

ALLOW (output exactly: ALLOW) for:
- normal consumer products: clothing, electronics, food, cosmetics, plants, home goods
- product photos on neutral backgrounds, packshots, lifestyle shots
- people fully clothed modelling products (clothing, accessories, watches)
- legitimate signage and branding

Output ONE line only — either "ALLOW" or "REJECT:<reason>". Nothing else.`;

export async function moderateImage(
  bytes: Buffer,
  contentType: string,
): Promise<ModerationVerdict> {
  if (!ANTHROPIC) {
    // Fail-open: no API key configured. Production sets ANTHROPIC_API_KEY.
    if (process.env.NODE_ENV !== "test") {
      console.warn("[moderation] ANTHROPIC_API_KEY not set — allowing upload");
    }
    return { ok: true };
  }

  // Claude doesn't accept image/jpg — normalize to image/jpeg.
  const mediaType =
    contentType === "image/jpg"
      ? "image/jpeg"
      : (contentType as "image/jpeg" | "image/png" | "image/webp" | "image/gif");
  if (
    mediaType !== "image/jpeg" &&
    mediaType !== "image/png" &&
    mediaType !== "image/webp" &&
    mediaType !== "image/gif"
  ) {
    // Unknown image type — fail-open. (Apple requires us to have a filter,
    // not to reject every novel mime.)
    return { ok: true };
  }

  try {
    const response = await ANTHROPIC.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: bytes.toString("base64"),
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    const block = response.content[0];
    if (!block || block.type !== "text") return { ok: true };
    const verdict = block.text.trim().split(/\r?\n/)[0]?.trim() ?? "";

    if (verdict.startsWith("REJECT")) {
      const reason = verdict.slice("REJECT:".length).trim() || "เนื้อหาไม่เหมาะสม";
      return { ok: false, reason };
    }
    return { ok: true };
  } catch (err) {
    console.error("[moderation] vision call failed", err);
    return { ok: true }; // fail-open
  }
}
