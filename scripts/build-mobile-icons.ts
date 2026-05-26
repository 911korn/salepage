/**
 * Renders the canonical SalePage brand SVGs to PNG assets the Expo app
 * needs:
 *   - mobile/assets/icon.png            1024x1024 — iOS app icon (white background, rounded corners are added by iOS)
 *   - mobile/assets/adaptive-icon.png   1024x1024 — Android adaptive foreground (transparent background)
 *   - mobile/assets/splash.png          1284x2778 — iOS Pro Max portrait launch screen (white background, centered lockup)
 *
 * 911korn 2026-05-26: "เอา icon zoom ออกจาก Slash ตอนแรก ทำ Animation มาแทน
 * ใช้ icon app ให้ถูกต้อง" — the Expo template's magnifying-glass artwork
 * has been on icon + splash since project init. This script replaces both
 * with the real SalePage shopping-tag mark from /public/brand/.
 *
 * Run with:  pnpm tsx scripts/build-mobile-icons.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(__dirname, "..");
const ICON_SRC = path.join(ROOT, "public/brand/salepage-icon.svg");
const LOCKUP_SRC = path.join(ROOT, "public/brand/salepage-lockup.svg");
const OUT_DIR = path.join(ROOT, "mobile/assets");

async function loadSvg(filepath: string): Promise<Buffer> {
  return await fs.readFile(filepath);
}

/**
 * iOS icon — 1024x1024 with the brand gradient as the full background and
 * the SalePage mark prominent in the center. iOS applies its own rounded
 * mask, so we ship a full-bleed square (no padding in the artwork itself).
 */
async function buildIos(iconSvg: Buffer) {
  const SIZE = 1024;
  const MARK_SIZE = 720; // ~70% of canvas for breathing room inside the iOS rounded mask
  const markPng = await sharp(iconSvg).resize(MARK_SIZE, MARK_SIZE).png().toBuffer();

  // Background: same brand gradient as the SVG itself, baked into a 1024 PNG.
  // We use a soft pink-to-rose linear so the mark (which is itself the same
  // gradient) still pops against it via the inner highlight + ink stroke.
  const bgSvg = Buffer.from(
    `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <linearGradient id="bg" x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" gradientUnits="userSpaceOnUse">
           <stop offset="0%" stop-color="#ffe4e6"/>
           <stop offset="100%" stop-color="#fda4af"/>
         </linearGradient>
       </defs>
       <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
     </svg>`,
  );
  const bgPng = await sharp(bgSvg).png().toBuffer();

  await sharp(bgPng)
    .composite([
      {
        input: markPng,
        left: Math.round((SIZE - MARK_SIZE) / 2),
        top: Math.round((SIZE - MARK_SIZE) / 2),
      },
    ])
    .png()
    .toFile(path.join(OUT_DIR, "icon.png"));
}

/**
 * Android adaptive icon foreground — transparent background, mark inset
 * so it survives the launcher's circle / squircle / teardrop masking
 * (66% safe zone per Material guidelines).
 */
async function buildAndroid(iconSvg: Buffer) {
  const SIZE = 1024;
  const SAFE = 540; // ~52% — inside Material's 66% safe zone
  const markPng = await sharp(iconSvg).resize(SAFE, SAFE).png().toBuffer();

  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: markPng,
        left: Math.round((SIZE - SAFE) / 2),
        top: Math.round((SIZE - SAFE) / 2),
      },
    ])
    .png()
    .toFile(path.join(OUT_DIR, "adaptive-icon.png"));
}

/**
 * Splash — iOS Pro Max portrait dimensions (1284x2778). White background
 * with the horizontal lockup centered. We pick the lockup (mark + Sale/Page
 * wordmark) instead of just the mark so the splash reads as a "brand
 * presence" beat rather than a stripped icon.
 *
 * `resizeMode: "contain"` in app.config.ts means the splash image is
 * letterboxed to fit; Android crops to the shorter edge so the same image
 * works on Pixel + iPhone. We keep the lockup small relative to the canvas
 * so even on the smallest device it never touches edge padding.
 */
async function buildSplash(lockupSvg: Buffer) {
  const WIDTH = 1284;
  const HEIGHT = 2778;
  // Lockup is 400x96. Aim ~70% of canvas width = 900 wide → 216 tall.
  const LOCKUP_WIDTH = 900;
  const LOCKUP_HEIGHT = Math.round((LOCKUP_WIDTH * 96) / 400);
  const lockupPng = await sharp(lockupSvg)
    .resize(LOCKUP_WIDTH, LOCKUP_HEIGHT)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: lockupPng,
        left: Math.round((WIDTH - LOCKUP_WIDTH) / 2),
        top: Math.round((HEIGHT - LOCKUP_HEIGHT) / 2),
      },
    ])
    .png()
    .toFile(path.join(OUT_DIR, "splash.png"));
}

async function main() {
  const [iconSvg, lockupSvg] = await Promise.all([
    loadSvg(ICON_SRC),
    loadSvg(LOCKUP_SRC),
  ]);
  await fs.mkdir(OUT_DIR, { recursive: true });
  await Promise.all([
    buildIos(iconSvg),
    buildAndroid(iconSvg),
    buildSplash(lockupSvg),
  ]);
  for (const file of ["icon.png", "adaptive-icon.png", "splash.png"]) {
    const stat = await fs.stat(path.join(OUT_DIR, file));
    console.log(`✓ ${file}  ${(stat.size / 1024).toFixed(1)} KB`);
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
