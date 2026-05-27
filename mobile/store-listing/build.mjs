// Marketing screenshot generator for the App Store + Play Store listings.
//
// Each output is 1290x2796 (iPhone 6.9" / 16 Pro Max canonical resolution).
// Layout:
//  - Rose-tinted gradient background bleeds from #ffe4e6 → #ffffff
//  - SalePage wordmark + Thai headline at the top
//  - Source screenshot inset below, ~88% width, soft drop shadow,
//    rounded corners.
//
// Uses Sharp via the goldsignal-assets project that already has it
// installed — no separate pnpm i required.
//
// Run: node mobile/store-listing/build.mjs

import sharp from "../../../goldsignal-assets/node_modules/sharp/lib/index.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "source");
const OUT = join(__dirname, "screenshots");

const W = 1290;
const H = 2796;
const DEVICE_TOP = 420;        // y of the device screenshot
const DEVICE_BOTTOM_PAD = 60;  // breathing room at bottom of canvas
const DEVICE_RADIUS = 56;      // rounded-corner radius
const SHADOW_BLUR = 36;
const SHADOW_DY = 24;

const SHOTS = [
  // Order optimised for shop-owner conversion (911korn 2026-05-28
  // "หลักๆ อยากชูโรงเรื่อง รับเงินไม่ผ่านคนกลาง"). The PromptPay
  // checkout shot leads — it's the strongest visual proof of the
  // direct-payment promise (QR code paying the seller's bank, not
  // a platform escrow account). Slots 2-3 reinforce: free + AI
  // migration. Slots 4-6 round out reach, ops, trust.
  {
    src: "IMG_5568.PNG",
    out: "01-money-direct.png",
    headline: "เงินถึงคุณ 100%",
    subhead: "ลูกค้าโอน PromptPay เข้าบัญชีร้านตรง · ไม่ผ่านคนกลาง",
    badge: "0%\nค่าธรรมเนียม",
  },
  {
    src: "IMG_5566.PNG",
    out: "02-open-shop-free.png",
    headline: "เปิดร้านฟรี · ขายได้ทันที",
    subhead: "Dashboard ครบ · KYC verified · เริ่มขายใน 30 วิ",
    badge: "ฟรี\n100%",
  },
  {
    src: "IMG_5567.PNG",
    out: "03-ai-migrate.png",
    headline: "AI ย้ายของจากร้านเดิม",
    subhead: "วางลิงก์ร้านเดิม · ดึงสินค้าทุกชิ้นใน 1 คลิก",
    badge: "AI\n1 คลิก",
  },
  {
    src: "IMG_5563.PNG",
    out: "04-customers-find-you.png",
    headline: "ลูกค้าเจอร้านคุณที่นี่",
    subhead: "ฟีดหน้าแรก · ขายดี · ใหม่ · มือสอง",
  },
  {
    src: "IMG_5565.PNG",
    out: "05-orders-one-place.png",
    headline: "คุมทุกออเดอร์ในมือเดียว",
    subhead: "รอชำระ · ชำระแล้ว · ส่งของ · รับแล้ว",
  },
  {
    src: "IMG_5564.PNG",
    out: "06-trust-verified.png",
    headline: "Verified · คะแนนน่าเชื่อถือ",
    subhead: "KYC ผ่านเครื่องหมาย ✓ · ลูกค้าเชื่อมั่น",
  },
];

const BRAND_ROSE_50 = { r: 255, g: 228, b: 230, alpha: 1 };
const BRAND_ROSE_100 = { r: 254, g: 205, b: 211, alpha: 1 };

function gradientSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fecdd3" />
      <stop offset="0.18" stop-color="#ffe4e6" />
      <stop offset="0.55" stop-color="#fff1f2" />
      <stop offset="1" stop-color="#ffffff" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)" />
</svg>`;
}

function textOverlaySvg(headline, subhead) {
  // Headline + subhead. Long Thai phrases need a smaller size + tighter
  // line-height to fit within the 1290px canvas at full padding. The
  // <foreignObject> path would let us word-wrap natively but Sharp's
  // librsvg builds don't always support it — we split the headline into
  // two lines ourselves when it's wider than ~25 chars.
  const headLines = wrapHeadline(headline, 22);
  const subhLines = wrapHeadline(subhead, 38);
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .head { font: 800 72px -apple-system, "PingFang TC", "Thonburi", "Noto Sans Thai", sans-serif; fill: #0a0a0a; }
    .sub  { font: 500 32px -apple-system, "PingFang TC", "Thonburi", "Noto Sans Thai", sans-serif; fill: #525252; }
    .brand { font: 800 42px -apple-system, sans-serif; fill: #0a0a0a; letter-spacing: -0.5px; }
  </style>
  <!-- SalePage logo lockup -->
  <g transform="translate(${W / 2 - 145}, 100)">
    <rect x="-60" y="-30" width="52" height="52" rx="14" ry="14" fill="#e11d48" />
    <text x="-34" y="7" text-anchor="middle" font-family="-apple-system, sans-serif" font-weight="900" font-size="36" fill="#fff">S</text>
    <text x="0" y="12" class="brand">SalePage</text>
  </g>
  ${headLines
    .map((line, i) => `<text x="${W / 2}" y="${220 + i * 82}" text-anchor="middle" class="head">${escapeXml(line)}</text>`)
    .join("\n  ")}
  ${subhLines
    .map(
      (line, i) =>
        `<text x="${W / 2}" y="${220 + headLines.length * 82 + 20 + i * 42}" text-anchor="middle" class="sub">${escapeXml(line)}</text>`,
    )
    .join("\n  ")}
</svg>`;
}

function wrapHeadline(text, maxChars) {
  // Thai doesn't use spaces between words, so we wrap on " " and " · "
  // delimiters only. Returns a list of lines.
  if (text.length <= maxChars) return [text];
  const parts = text.split(/(\s+·\s+|\s+)/);
  const lines = [];
  let cur = "";
  for (const part of parts) {
    if ((cur + part).length <= maxChars) {
      cur += part;
    } else {
      if (cur.trim()) lines.push(cur.trim());
      cur = part;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.length > 0 ? lines : [text];
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function badgeSvg(badgeText) {
  // Rose-red circular sticker top-right of the device. Two lines centered.
  const lines = badgeText.split("\n");
  const cx = W - 170;
  const cy = 540;
  const radius = 130;
  // Slight tilt for sticker feel.
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="bsh" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
      <feOffset dx="0" dy="6" result="off" />
      <feComponentTransfer><feFuncA type="linear" slope="0.45" /></feComponentTransfer>
      <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
  <g transform="rotate(-8 ${cx} ${cy})" filter="url(#bsh)">
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#e11d48" />
    <circle cx="${cx}" cy="${cy}" r="${radius - 8}" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="6 4" stroke-opacity="0.5" />
    ${lines
      .map(
        (line, i) =>
          `<text x="${cx}" y="${cy + (i - (lines.length - 1) / 2) * 56 + 18}" text-anchor="middle" font-family="-apple-system, sans-serif" font-weight="900" font-size="52" fill="#ffffff">${escapeXml(line)}</text>`,
      )
      .join("\n    ")}
  </g>
</svg>`;
}

async function buildOne({ src, out, headline, subhead, badge }) {
  const srcBuf = await readFile(join(SRC, src));
  const srcMeta = await sharp(srcBuf).metadata();

  // Compute target device size — fit within the available height below
  // the headline, keeping the original aspect ratio so the screenshot
  // bottom (tab bar / home indicator) isn't cropped.
  const aspect = srcMeta.height / srcMeta.width;
  const availH = H - DEVICE_TOP - DEVICE_BOTTOM_PAD;
  let targetH = availH;
  let targetW = Math.round(targetH / aspect);
  // If width-bound (rare for iPhone screenshots, but possible) cap it.
  const maxW = W - 120;
  if (targetW > maxW) {
    targetW = maxW;
    targetH = Math.round(targetW * aspect);
  }
  const deviceLeft = Math.round((W - targetW) / 2);

  // Resize the source screenshot to the target width.
  const resized = await sharp(srcBuf).resize({ width: targetW }).png().toBuffer();

  // Apply rounded-corner mask + drop shadow. Sharp's compositing model:
  //  1. Mask the source with a rounded-rect SVG → cropped corners.
  //  2. Render a soft black shadow rect under the masked image.
  const maskSvg = Buffer.from(
    `<svg width="${targetW}" height="${targetH}"><rect x="0" y="0" width="${targetW}" height="${targetH}" rx="${DEVICE_RADIUS}" ry="${DEVICE_RADIUS}" fill="white" /></svg>`,
  );
  const masked = await sharp(resized)
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png()
    .toBuffer();

  const shadowSvg = Buffer.from(
    `<svg width="${W}" height="${H}"><defs><filter id="b"><feGaussianBlur stdDeviation="${SHADOW_BLUR}" /></filter></defs><rect x="${deviceLeft}" y="${DEVICE_TOP + SHADOW_DY}" width="${targetW}" height="${targetH}" rx="${DEVICE_RADIUS}" ry="${DEVICE_RADIUS}" fill="black" fill-opacity="0.18" filter="url(#b)" /></svg>`,
  );

  // Build the canvas: gradient → shadow → text overlay → masked
  // screenshot → optional badge sticker on top.
  const layers = [
    { input: shadowSvg, top: 0, left: 0 },
    { input: Buffer.from(textOverlaySvg(headline, subhead)), top: 0, left: 0 },
    { input: masked, top: DEVICE_TOP, left: deviceLeft },
  ];
  if (badge) {
    layers.push({ input: Buffer.from(badgeSvg(badge)), top: 0, left: 0 });
  }
  const canvas = await sharp(Buffer.from(gradientSvg()))
    .composite(layers)
    .png()
    .toBuffer();

  await writeFile(join(OUT, out), canvas);
  console.log(`✓ ${out} (${targetW}x${targetH} screenshot)`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const shot of SHOTS) {
    try {
      await buildOne(shot);
    } catch (e) {
      console.error(`✗ ${shot.out}:`, e.message);
    }
  }
}

main();
