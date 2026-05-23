import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify LINE Messaging webhook signature.
 * See: developers.line.biz/en/reference/messaging-api/#signature-validation
 */
export function verifyLineSignature(
  rawBody: string,
  signature: string,
  channelSecret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", channelSecret)
    .update(rawBody, "utf8")
    .digest("base64");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Push a text message to a LINE user. Uses the Push API which is rate-limited
 * (200/month on free tier). For inside-reply-window messaging, prefer the Reply
 * API with the event's replyToken — we don't keep replyToken between requests
 * so push is the simpler primitive for dashboard-side sends.
 */
export async function pushLineMessage(opts: {
  channelAccessToken: string;
  toUserId: string;
  text: string;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: opts.toUserId,
      messages: [{ type: "text", text: opts.text.slice(0, 5000) }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: txt };
  }
  return { ok: true, status: 200 };
}

/**
 * Reply via the event's replyToken (free, unlimited within ~30 seconds of the
 * inbound message). Used by the webhook to auto-acknowledge or by the dashboard
 * to reply quickly to the most recent inbound.
 */
export async function replyLineMessage(opts: {
  channelAccessToken: string;
  replyToken: string;
  text: string;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken: opts.replyToken,
      messages: [{ type: "text", text: opts.text.slice(0, 5000) }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: txt };
  }
  return { ok: true, status: 200 };
}

/**
 * Fetch a LINE user's display name + avatar. Best-effort; returns null on any
 * error (user blocked the bot, network, etc.).
 */
export async function getLineProfile(opts: {
  channelAccessToken: string;
  userId: string;
}): Promise<{ displayName?: string; pictureUrl?: string } | null> {
  try {
    const res = await fetch(
      `https://api.line.me/v2/bot/profile/${encodeURIComponent(opts.userId)}`,
      {
        headers: { Authorization: `Bearer ${opts.channelAccessToken}` },
      },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface LineMessageEvent {
  type: "message";
  replyToken: string;
  source: { type: "user" | "group" | "room"; userId?: string };
  message: { id: string; type: string; text?: string };
}
