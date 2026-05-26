import * as ImageManipulator from "expo-image-manipulator";

/**
 * Downscale + JPEG-compress an image picked or shot on-device before we ship
 * it across the wire. Slips are routinely 5–10 MB raw on modern phones —
 * that wastes bandwidth, Vercel Blob storage, and SlipOK provider reads.
 *
 * The 1600-pixel longest-edge + quality 0.82 combo mirrors what the web
 * side does for product uploads (see `src/components/dashboard/product-form.tsx`).
 * It keeps slip text crisp enough for SlipOK / EasySlip OCR while bringing
 * payloads down to ~150–400 KB.
 *
 * Returns the new local URI + base64 string (sans data: prefix). Caller is
 * responsible for posting the base64 to the slip-verify endpoint.
 */
export async function compressForSlipUpload(uri: string): Promise<{
  uri: string;
  base64: string;
}> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  if (!result.base64) {
    throw new Error("ImageManipulator did not return base64");
  }
  return { uri: result.uri, base64: result.base64 };
}
