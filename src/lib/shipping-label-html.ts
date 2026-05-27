import QRCode from "qrcode";

/**
 * Drop-off shipping label generator. No courier API needed — seller
 * prints this HTML page, sticks it on the parcel, hands it to ANY
 * courier (Flash/Kerry/J&T/Thai Post), pays cash at the counter.
 *
 * The courier puts its own tracking barcode on top of (or next to) ours.
 * We scan that courier receipt later via Claude vision to recover the
 * tracking number (`/shipment/receipt` route).
 *
 * Layout fits a single 100×150mm thermal label or a quarter of an A4
 * (CSS @page rules let the seller pick the right size at print time).
 * 911korn 2026-05-27 "เราสร้างใบปะหน้าเอง ได้เลย".
 */

export interface ShippingLabelInput {
  orderRef: string;
  publicToken: string;
  trackingUrl: string; // absolute, for the QR
  shop: {
    name: string;
    senderName?: string | null;
    senderPhone?: string | null;
    senderAddress?: string | null;
  };
  receiver: {
    name: string;
    phone: string | null;
    address: string | null;
  };
  items: Array<{ name: string; qty: number }>;
  shippingFeeSatang: number;
  totalSatang: number;
  notes: string | null;
}

export async function renderShippingLabelHtml(
  input: ShippingLabelInput,
): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(input.trackingUrl, {
    margin: 1,
    errorCorrectionLevel: "M",
    scale: 4,
  });

  const itemsList = input.items
    .slice(0, 8)
    .map(
      (it) =>
        `<li>${escapeHtml(it.name)} <span class="qty">×${it.qty}</span></li>`,
    )
    .join("");
  const extraItems = input.items.length > 8 ? input.items.length - 8 : 0;

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>ใบปะหน้า ${escapeHtml(input.orderRef)} · SalePage</title>
<style>
@page { size: A6; margin: 6mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #f5f5f5; color: #18181b; font-family: -apple-system, BlinkMacSystemFont, "Inter", "Sarabun", sans-serif; }
.toolbar { position: sticky; top: 0; display: flex; gap: 8px; align-items: center; padding: 12px 16px; background: white; border-bottom: 1px solid #e5e5e5; }
.toolbar button { padding: 10px 16px; border: 0; border-radius: 10px; background: #18181b; color: white; font-weight: 600; font-size: 14px; cursor: pointer; }
.toolbar button:hover { background: #27272a; }
.toolbar .hint { font-size: 12px; color: #71717a; }
.page { background: white; max-width: 105mm; margin: 16px auto; padding: 6mm; border: 1px solid #e5e5e5; box-shadow: 0 4px 16px rgba(0,0,0,.04); }
@media print {
  .toolbar { display: none; }
  .page { margin: 0; box-shadow: none; border: 0; max-width: none; }
  html, body { background: white; }
}
.brand { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 4mm; border-bottom: 2px solid #18181b; }
.brand .logo { font-weight: 800; font-size: 16px; letter-spacing: -0.01em; }
.brand .ref { font-size: 11px; font-family: ui-monospace, Menlo, monospace; color: #18181b; text-align: right; }
.ref strong { display: block; font-size: 14px; }
.section { margin-top: 4mm; }
.label-tiny { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; }
.from { font-size: 11px; line-height: 1.4; color: #404040; }
.from .name { font-weight: 700; color: #18181b; }
.to { padding: 3mm; border: 1.5px solid #18181b; border-radius: 2mm; }
.to .name { font-size: 16px; font-weight: 800; line-height: 1.2; }
.to .phone { font-size: 13px; font-family: ui-monospace, Menlo, monospace; margin-top: 1mm; color: #18181b; }
.to .address { font-size: 12px; line-height: 1.5; margin-top: 2mm; white-space: pre-line; color: #18181b; }
.qr-row { display: flex; gap: 4mm; align-items: center; margin-top: 4mm; padding-top: 4mm; border-top: 1px dashed #d4d4d8; }
.qr-row img { width: 24mm; height: 24mm; flex-shrink: 0; }
.qr-row .meta { font-size: 10px; color: #52525b; line-height: 1.5; }
.qr-row .meta strong { color: #18181b; }
.items { margin-top: 3mm; font-size: 10px; color: #52525b; line-height: 1.4; }
.items ul { list-style: none; padding: 0; margin: 1mm 0 0; }
.items li { padding: 0.5mm 0; }
.items .qty { color: #71717a; font-family: ui-monospace, Menlo, monospace; }
.notes { margin-top: 3mm; padding: 2mm; background: #fef3c7; border-radius: 2mm; font-size: 10px; color: #78350f; }
.footer { margin-top: 4mm; padding-top: 2mm; border-top: 1px dashed #d4d4d8; font-size: 9px; color: #a1a1aa; text-align: center; }
</style>
</head>
<body>
<div class="toolbar">
  <button onclick="window.print()">พิมพ์</button>
  <span class="hint">เลือก A6 หรือ thermal label · พิมพ์ → ติดที่กล่อง → drop ที่ courier ไหนก็ได้</span>
</div>
<div class="page">
  <div class="brand">
    <div class="logo">SalePage</div>
    <div class="ref">
      <span class="label-tiny">Order</span>
      <strong>${escapeHtml(input.orderRef)}</strong>
    </div>
  </div>

  <div class="section">
    <div class="label-tiny">จาก (ผู้ส่ง)</div>
    <div class="from">
      <span class="name">${escapeHtml(input.shop.senderName ?? input.shop.name)}</span>${
    input.shop.senderPhone ? ` · ${escapeHtml(input.shop.senderPhone)}` : ""
  }${input.shop.senderAddress ? `<br />${escapeHtml(input.shop.senderAddress)}` : ""}
    </div>
  </div>

  <div class="section">
    <div class="label-tiny">ถึง (ผู้รับ)</div>
    <div class="to">
      <div class="name">${escapeHtml(input.receiver.name)}</div>
      ${input.receiver.phone ? `<div class="phone">${escapeHtml(input.receiver.phone)}</div>` : ""}
      ${input.receiver.address ? `<div class="address">${escapeHtml(input.receiver.address)}</div>` : ""}
    </div>
  </div>

  <div class="qr-row">
    <img src="${qrDataUrl}" alt="QR tracking" />
    <div class="meta">
      สแกนเพื่อติดตามสถานะ<br />
      <strong>salepage.in.th/o/${escapeHtml(input.publicToken)}</strong><br />
      ค่าส่ง: ฿${(input.shippingFeeSatang / 100).toLocaleString()} · รวม: ฿${(input.totalSatang / 100).toLocaleString()}
    </div>
  </div>

  ${itemsList ? `<div class="items"><div class="label-tiny">รายการ</div><ul>${itemsList}${extraItems ? `<li>+อีก ${extraItems} รายการ</li>` : ""}</ul></div>` : ""}

  ${input.notes ? `<div class="notes">${escapeHtml(input.notes)}</div>` : ""}

  <div class="footer">salepage.in.th · ปริ๊น → ติดที่กล่อง → drop-off → ถ่ายรูปใบเสร็จ courier กลับเข้าระบบ</div>
</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
