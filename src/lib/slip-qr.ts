import "server-only";

import jsQR from "jsqr";
import sharp from "sharp";

const MAX_SIDE = 1200;

export async function extractSlipQrPayloadFromBase64(
  imageBase64: string | undefined,
): Promise<string | null> {
  if (!imageBase64) return null;

  try {
    const input = Buffer.from(stripDataUrlPrefix(imageBase64), "base64");
    const { data, info } = await sharp(input)
      .rotate()
      .resize({
        width: MAX_SIDE,
        height: MAX_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8ClampedArray(
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
    for (const region of scanRegions(info.width, info.height)) {
      const payload = scanRegion(pixels, info.width, info.height, region);
      if (payload) return payload;
    }
  } catch {
    return null;
  }

  return null;
}

function stripDataUrlPrefix(value: string) {
  const comma = value.indexOf(",");
  return comma >= 0 ? value.slice(comma + 1) : value;
}

function scanRegions(width: number, height: number) {
  return [
    {
      x: Math.round(width * 0.45),
      y: Math.round(height * 0.45),
      width: Math.round(width * 0.55),
      height: Math.round(height * 0.38),
    },
    {
      x: Math.round(width * 0.25),
      y: Math.round(height * 0.35),
      width: Math.round(width * 0.75),
      height: Math.round(height * 0.5),
    },
    { x: 0, y: 0, width, height },
  ];
}

function scanRegion(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  region: { x: number; y: number; width: number; height: number },
) {
  const width = Math.max(1, Math.min(region.width, sourceWidth - region.x));
  const height = Math.max(1, Math.min(region.height, sourceHeight - region.y));
  const cropped = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((region.y + y) * sourceWidth + region.x) * 4;
    const sourceEnd = sourceStart + width * 4;
    cropped.set(source.subarray(sourceStart, sourceEnd), y * width * 4);
  }

  return jsQR(cropped, width, height, {
    inversionAttempts: "dontInvert",
  })?.data?.trim() || null;
}
