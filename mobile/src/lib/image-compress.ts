import * as ImageManipulator from "expo-image-manipulator";

/**
 * Downscale + JPEG-compress an image picked or shot on-device before we
 * ship it across the wire. Modern iPhone photos are routinely 8–15 MB
 * raw — that wastes bandwidth + Vercel Blob storage + SlipOK provider
 * reads.
 *
 * Default (`mode = "slip"`): 1600-pixel longest edge, quality 0.82.
 * Mirrors what the web product-form does. Keeps slip text crisp enough
 * for SlipOK / EasySlip OCR while bringing payloads down to ~150-400 KB.
 *
 * `mode = "banner"`: 1280-pixel longest edge, quality 0.78. Banners
 * render at h-44 (or 176px on the shop hero) so a 1280px source is
 * 2.5x retina headroom and still ~80-180 KB on the wire — 911korn
 * 2026-05-27 flagged banner upload as too slow.
 *
 * `mode = "thumb"`: 640px longest edge, quality 0.75. For logos +
 * profile pics.
 *
 * Returns the new local URI + base64 string (sans data: prefix). Caller
 * passes the base64 to the upload endpoint.
 */
export async function compressForSlipUpload(
  uri: string,
  mode: "slip" | "banner" | "thumb" = "slip",
): Promise<{ uri: string; base64: string }> {
  const preset = COMPRESSION_PRESETS[mode];
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: preset.width } }],
    {
      compress: preset.quality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  if (!result.base64) {
    throw new Error("ImageManipulator did not return base64");
  }
  return { uri: result.uri, base64: result.base64 };
}

const COMPRESSION_PRESETS = {
  slip: { width: 1600, quality: 0.82 },
  banner: { width: 1280, quality: 0.78 },
  thumb: { width: 640, quality: 0.75 },
} as const;

/**
 * Banner-tuned compressor — shorthand for `compressForSlipUpload(uri, "banner")`.
 */
export async function compressForBannerUpload(uri: string): Promise<{
  uri: string;
  base64: string;
}> {
  return compressForSlipUpload(uri, "banner");
}

/**
 * Logo-tuned compressor — shorthand for `compressForSlipUpload(uri, "thumb")`.
 */
export async function compressForThumbUpload(uri: string): Promise<{
  uri: string;
  base64: string;
}> {
  return compressForSlipUpload(uri, "thumb");
}
