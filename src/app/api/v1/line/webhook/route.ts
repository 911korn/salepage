import { NextResponse } from "next/server";
import {
  buildPlatformLineLiffUrl,
  getPlatformLineChannelAccessToken,
  getPlatformLineChannelSecret,
  replyLineMessage,
  verifyLineSignature,
} from "@/lib/line";

export const runtime = "nodejs";

interface PlatformLineEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
}

/**
 * Central @salepage LINE OA webhook.
 *
 * Shop-owned LINE inboxes keep using /api/v1/line/webhook/:shopId. This route
 * is only for buyer identity + order status UX under the @salepage OA.
 */
export async function POST(request: Request) {
  const channelSecret = getPlatformLineChannelSecret();
  const channelAccessToken = getPlatformLineChannelAccessToken();
  if (!channelSecret || !channelAccessToken) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 404 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";
  if (!verifyLineSignature(rawBody, signature, channelSecret)) {
    return NextResponse.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 },
    );
  }

  let body: { events?: PlatformLineEvent[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  await Promise.all(
    (body.events ?? [])
      .filter((event) => event.replyToken && event.source?.type === "user")
      .map((event) => {
        const ordersUrl =
          buildPlatformLineLiffUrl("/line/orders") ?? `${siteUrl()}/line/orders`;
        return replyLineMessage({
          channelAccessToken,
          replyToken: event.replyToken!,
          text:
            "ดูสถานะออเดอร์ของคุณได้ที่\n" +
            `${ordersUrl}\n\n` +
            "ใช้บัญชี LINE เดิมที่สั่งซื้อ ระบบจะแสดงออเดอร์ให้อัตโนมัติ",
        }).catch((e) => {
          console.warn("[line] platform webhook reply failed:", e);
        });
      }),
  );

  return NextResponse.json({ ok: true });
}

function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`.replace(/\/$/, "");
  return "https://salepage.in.th";
}
