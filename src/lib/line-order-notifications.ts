import "server-only";

import { OrderStatus } from "@/lib/db";
import {
  getPlatformLineChannelAccessToken,
  pushLineMessage,
} from "@/lib/line";
import { buildOrderRef } from "@/lib/orders";

interface LineOrderNotification {
  id: string;
  publicToken: string;
  status: OrderStatus | string;
  customerName: string;
  customerLineUserId: string | null;
  totalSatang: number;
  trackingNumber: string | null;
  createdAt: Date;
  shop: {
    name: string;
    slug: string;
  };
}

export async function notifyLineOrderUpdate(
  order: LineOrderNotification,
): Promise<void> {
  if (!order.customerLineUserId) return;
  const channelAccessToken = getPlatformLineChannelAccessToken();
  if (!channelAccessToken) return;

  const result = await pushLineMessage({
    channelAccessToken,
    toUserId: order.customerLineUserId,
    text: buildLineOrderText(order),
  });
  if (!result.ok) {
    console.warn(
      `[line] order notification failed ${result.status}: ${result.error ?? "unknown"}`,
    );
  }
}

function buildLineOrderText(order: LineOrderNotification): string {
  const ref = buildOrderRef(order.createdAt, order.id);
  const statusText = orderStatusText(order.status);
  const total = (order.totalSatang / 100).toLocaleString("th-TH");
  const statusUrl = `${siteUrl()}/o/${order.publicToken}`;
  const tracking = order.trackingNumber
    ? `\nเลขพัสดุ: ${order.trackingNumber}`
    : "";

  return [
    `${statusText}`,
    `${order.shop.name} ${ref}`,
    `ยอดรวม ฿${total}${tracking}`,
    "",
    `ดูสถานะออเดอร์: ${statusUrl}`,
  ].join("\n");
}

function orderStatusText(status: OrderStatus | string): string {
  switch (status) {
    case OrderStatus.PAID:
      return "SalePage รับชำระเงินแล้ว";
    case OrderStatus.SHIPPING:
      return "ร้านเริ่มจัดส่งออเดอร์แล้ว";
    case OrderStatus.DELIVERED:
      return "ออเดอร์ส่งสำเร็จแล้ว";
    case OrderStatus.CANCELLED:
      return "ออเดอร์ถูกยกเลิกแล้ว";
    case OrderStatus.REFUNDED:
      return "ออเดอร์คืนเงินแล้ว";
    default:
      return "อัปเดตสถานะออเดอร์";
  }
}

function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`.replace(/\/$/, "");
  return "https://salepage.in.th";
}
