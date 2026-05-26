/**
 * Email notifications for orders. Powered by Resend.
 *
 * - All `send*` functions are fire-and-forget from the caller's perspective:
 *   they catch errors internally and log to console. An email failure must
 *   never break a payment / order flow.
 * - `noreply@salepage.in.th` is the verified Resend sender (domain verified
 *   2026-05-23). Replies go to operator inbox via the shop's contact info
 *   (which the customer also sees in the email body).
 */

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

const RESEND_URL = "https://api.resend.com/emails";

export async function send({ to, subject, html, replyTo }: SendArgs): Promise<void> {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) {
    console.warn("[email] AUTH_RESEND_KEY not set — skipping email send");
    return;
  }
  const from = process.env.AUTH_EMAIL_FROM ?? "SalePage <noreply@salepage.in.th>";
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[email] send to ${to} failed: ${res.status} ${body.slice(0, 300)}`);
    }
  } catch (e) {
    console.warn(`[email] send to ${to} threw:`, e);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const BRAND = "#e11d48";

function shell({ heading, body, cta }: {
  heading: string;
  body: string;
  cta?: { label: string; url: string };
}) {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#fafafa;font-family:'Helvetica Neue',Arial,sans-serif;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border:1px solid #e4e4e7;border-radius:24px;padding:32px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
        <div style="width:36px;height:36px;background:${BRAND};border-radius:10px;display:inline-block;"></div>
        <span style="font-weight:700;font-size:18px;letter-spacing:-0.01em;">Sale<span style="color:${BRAND};">Page</span></span>
      </div>
      <h1 style="font-size:22px;margin:0 0 12px 0;line-height:1.3;">${heading}</h1>
      <div style="font-size:15px;line-height:1.6;color:#52525b;">${body}</div>
      ${cta ? `
      <div style="margin:28px 0 4px 0;">
        <a href="${cta.url}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;">${cta.label}</a>
      </div>` : ""}
    </div>
    <p style="text-align:center;color:#a1a1aa;font-size:11px;margin-top:16px;">
      © ${new Date().getFullYear()} SalePage · salepage.in.th
    </p>
  </div>
</body></html>`;
}

function itemRows(items: Array<{ productName: string; qty: number; priceSatang: number }>) {
  return items.map((it) => `
    <tr>
      <td style="padding:8px 0;">${escapeHtml(it.productName)} <span style="color:#a1a1aa;">×${it.qty}</span></td>
      <td style="padding:8px 0;text-align:right;font-weight:600;">฿${((it.priceSatang * it.qty) / 100).toLocaleString()}</td>
    </tr>`).join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function siteUrl(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL;
  if (u) return u.replace(/\/$/, "");
  const v = process.env.VERCEL_URL;
  if (v) return `https://${v}`;
  return "https://salepage.in.th";
}

// ─── Public senders ───────────────────────────────────────────────────────

interface OrderContext {
  ref: string;
  token: string;
  customerName: string;
  customerEmail?: string | null;
  totalSatang: number;
  items: Array<{ productName: string; qty: number; priceSatang: number }>;
  shopName: string;
  shopContactEmail?: string | null;
}

/** Customer: confirmation of a new pending order + tracking link. */
export async function sendOrderCreated(ctx: OrderContext): Promise<void> {
  if (!ctx.customerEmail) return;
  const trackingUrl = `${siteUrl()}/o/${ctx.token}`;
  const html = shell({
    heading: `ขอบคุณสำหรับการสั่งซื้อ ${ctx.ref}`,
    body: `
      <p>สวัสดีคุณ <strong>${escapeHtml(ctx.customerName)}</strong>,</p>
      <p>เราได้รับออเดอร์ของคุณจาก <strong>${escapeHtml(ctx.shopName)}</strong> เรียบร้อยแล้ว</p>
      <table style="width:100%;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;margin:16px 0;font-size:14px;">
        ${itemRows(ctx.items)}
        <tr><td style="padding-top:12px;color:#a1a1aa;">ยอดรวม</td><td style="padding-top:12px;text-align:right;font-weight:700;color:${BRAND};font-size:18px;">฿${(ctx.totalSatang / 100).toLocaleString()}</td></tr>
      </table>
      <p>ขั้นตอนถัดไป — แตะปุ่มด้านล่างเพื่อเปิดหน้า PromptPay QR และอัปสลิป หลังโอนเงินเสร็จ:</p>
    `,
    cta: { label: "เปิดหน้าชำระเงิน", url: trackingUrl },
  });
  await send({
    to: ctx.customerEmail,
    subject: `ออเดอร์ ${ctx.ref} ของคุณรอชำระเงิน — ${ctx.shopName}`,
    html,
    replyTo: ctx.shopContactEmail ?? undefined,
  });
}

/** Customer: payment verified, order moved to PAID. */
export async function sendOrderPaid(ctx: OrderContext & { slipRef?: string }): Promise<void> {
  if (!ctx.customerEmail) return;
  const trackingUrl = `${siteUrl()}/o/${ctx.token}`;
  const html = shell({
    heading: `ยืนยันการชำระเงิน ${ctx.ref}`,
    body: `
      <p>ขอบคุณ! เรายืนยันการชำระเงินของคุณเรียบร้อย</p>
      <p>ร้าน <strong>${escapeHtml(ctx.shopName)}</strong> จะจัดเตรียมพัสดุของคุณภายในเร็วๆ นี้</p>
      ${ctx.slipRef ? `<p style="color:#a1a1aa;font-size:13px;">เลขอ้างอิงสลิป: <code>${escapeHtml(ctx.slipRef)}</code></p>` : ""}
    `,
    cta: { label: "ดูสถานะออเดอร์", url: trackingUrl },
  });
  await send({
    to: ctx.customerEmail,
    subject: `ยืนยันการชำระเงิน · ${ctx.shopName} (${ctx.ref})`,
    html,
    replyTo: ctx.shopContactEmail ?? undefined,
  });
}

/** Customer: shop has marked order as SHIPPING. */
export async function sendOrderShipped(ctx: OrderContext & { trackingNumber?: string | null }): Promise<void> {
  if (!ctx.customerEmail) return;
  const trackingUrl = `${siteUrl()}/o/${ctx.token}`;
  const html = shell({
    heading: `พัสดุของคุณออกเดินทางแล้ว 📦`,
    body: `
      <p>ร้าน <strong>${escapeHtml(ctx.shopName)}</strong> ได้จัดส่งพัสดุของคุณแล้ว</p>
      ${ctx.trackingNumber ? `
      <div style="background:#fafafa;border-radius:12px;padding:16px;margin:16px 0;">
        <p style="color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:.16em;margin:0;">Tracking number</p>
        <p style="font-family:monospace;font-size:18px;font-weight:700;margin:6px 0 0 0;">${escapeHtml(ctx.trackingNumber)}</p>
      </div>` : ""}
    `,
    cta: { label: "ติดตามพัสดุ", url: trackingUrl },
  });
  await send({
    to: ctx.customerEmail,
    subject: `จัดส่งแล้ว · ${ctx.shopName} (${ctx.ref})`,
    html,
    replyTo: ctx.shopContactEmail ?? undefined,
  });
}

/** Shop owner: heads-up that a new pending order arrived. */
export async function sendNewOrderAlert(
  ctx: OrderContext & { ownerEmail: string; dashboardSlug: string },
): Promise<void> {
  const dashboardUrl = `${siteUrl()}/dashboard/orders/${ctx.token}`;
  const html = shell({
    heading: `🛒 ออเดอร์ใหม่ ${ctx.ref}`,
    body: `
      <p>ลูกค้า <strong>${escapeHtml(ctx.customerName)}</strong> สั่งซื้อจาก <strong>${escapeHtml(ctx.shopName)}</strong></p>
      <table style="width:100%;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;margin:16px 0;font-size:14px;">
        ${itemRows(ctx.items)}
        <tr><td style="padding-top:12px;color:#a1a1aa;">ยอดรวม</td><td style="padding-top:12px;text-align:right;font-weight:700;color:${BRAND};font-size:18px;">฿${(ctx.totalSatang / 100).toLocaleString()}</td></tr>
      </table>
      <p style="color:#a1a1aa;font-size:13px;">รอลูกค้าโอนเงิน + อัปสลิป — คุณจะได้ email อีกครั้งตอน slip ตรวจผ่าน</p>
    `,
    cta: { label: "เปิดออเดอร์ในแดชบอร์ด", url: dashboardUrl },
  });
  await send({
    to: ctx.ownerEmail,
    subject: `🛒 ออเดอร์ใหม่ ${ctx.ref} · ฿${(ctx.totalSatang / 100).toLocaleString()}`,
    html,
  });
}

/** Shop owner: payment was verified for an order. */
export async function sendPaymentReceivedAlert(
  ctx: OrderContext & { ownerEmail: string; slipRef?: string },
): Promise<void> {
  const dashboardUrl = `${siteUrl()}/dashboard/orders/${ctx.token}`;
  const html = shell({
    heading: `💰 ได้รับเงินแล้ว ${ctx.ref}`,
    body: `
      <p>ลูกค้า <strong>${escapeHtml(ctx.customerName)}</strong> ชำระเงิน <strong>฿${(ctx.totalSatang / 100).toLocaleString()}</strong> สำหรับออเดอร์ที่ <strong>${escapeHtml(ctx.shopName)}</strong> เรียบร้อย</p>
      ${ctx.slipRef ? `<p style="color:#a1a1aa;font-size:13px;">สลิป ref: <code>${escapeHtml(ctx.slipRef)}</code></p>` : ""}
      <p>จัดเตรียมพัสดุได้เลย — กดปุ่มเพื่อเริ่มกระบวนการจัดส่ง</p>
    `,
    cta: { label: "ไปจัดส่ง", url: dashboardUrl },
  });
  await send({
    to: ctx.ownerEmail,
    subject: `💰 ${ctx.shopName}: ได้รับเงิน ฿${(ctx.totalSatang / 100).toLocaleString()} (${ctx.ref})`,
    html,
  });
}
