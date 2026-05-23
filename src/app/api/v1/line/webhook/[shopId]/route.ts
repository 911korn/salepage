import { NextResponse } from "next/server";
import {
  db,
  ConversationMessageDirection,
} from "@/lib/db";
import {
  verifyLineSignature,
  getLineProfile,
  type LineMessageEvent,
} from "@/lib/line";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // need raw body access for signature verification

/**
 * LINE Messaging webhook receiver.
 *
 * Routing: each shop has its own webhook URL `/api/v1/line/webhook/<shopId>`
 * registered in their LINE Developers console. We look up the shop, verify the
 * x-line-signature against shop.lineChannelSecret, then upsert Conversation
 * + ConversationMessage rows.
 *
 * Idempotency: ConversationMessage.lineMessageId is @unique, so retried webhook
 * deliveries from LINE don't double-write.
 *
 * Plan gating: webhook ignores requests for shops whose
 * (Subscription.plan is FREE/STARTER/PRO) OR (lineWebhookEnabled=false).
 * Gating is enforced at config time in the settings PATCH endpoint, so by the
 * time a webhook arrives the integration is already legitimate.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ shopId: string }> },
) {
  const { shopId } = await ctx.params;
  const signature = request.headers.get("x-line-signature") ?? "";
  const rawBody = await request.text();

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      lineChannelSecret: true,
      lineChannelAccessToken: true,
      lineWebhookEnabled: true,
    },
  });
  if (
    !shop ||
    !shop.lineChannelSecret ||
    !shop.lineChannelAccessToken ||
    !shop.lineWebhookEnabled
  ) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 404 });
  }

  if (!verifyLineSignature(rawBody, signature, shop.lineChannelSecret)) {
    return NextResponse.json(
      { ok: false, error: "bad_signature" },
      { status: 401 },
    );
  }

  let body: { events?: LineMessageEvent[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  for (const event of body.events ?? []) {
    if (event.type !== "message") continue;
    if (event.source.type !== "user" || !event.source.userId) continue;
    if (event.message.type !== "text" || !event.message.text) continue;

    const userId = event.source.userId;
    const text = event.message.text;
    const lineMessageId = event.message.id;

    // De-dup: LINE may retry webhook deliveries
    const existing = await db.conversationMessage.findUnique({
      where: { lineMessageId },
      select: { id: true },
    });
    if (existing) continue;

    // Look up + cache LINE profile (display name + avatar)
    const profile = await getLineProfile({
      channelAccessToken: shop.lineChannelAccessToken,
      userId,
    });

    const conversation = await db.conversation.upsert({
      where: {
        shopId_customerLineUserId: {
          shopId: shop.id,
          customerLineUserId: userId,
        },
      },
      create: {
        shopId: shop.id,
        customerLineUserId: userId,
        customerName: profile?.displayName ?? null,
        customerAvatar: profile?.pictureUrl ?? null,
        lastMessageAt: new Date(),
        lastMessageText: text,
        unreadCount: 1,
      },
      update: {
        ...(profile?.displayName ? { customerName: profile.displayName } : {}),
        ...(profile?.pictureUrl ? { customerAvatar: profile.pictureUrl } : {}),
        lastMessageAt: new Date(),
        lastMessageText: text,
        unreadCount: { increment: 1 },
      },
    });

    await db.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        direction: ConversationMessageDirection.INBOUND,
        text,
        lineMessageId,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
