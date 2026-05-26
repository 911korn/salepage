import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, ConversationMessageDirection } from "@/lib/db";
import { pushLineMessage } from "@/lib/line";

const ReplyBody = z.object({
  text: z.string().min(1).max(5000),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug, id } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const conversation = await db.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });
  if (!conversation || conversation.shopId !== shop.id)
    return fail("not_found", "ไม่พบบทสนทนา", 404);

  // Mark read on fetch
  if (conversation.unreadCount > 0) {
    await db.conversation.update({
      where: { id: conversation.id },
      data: { unreadCount: 0 },
    });
  }

  return ok({ conversation });
}

/**
 * POST /api/v1/shops/:slug/conversations/:id — owner sends a reply.
 *
 * Uses LINE Push API (not Reply API) because we don't store replyTokens
 * between requests, and the dashboard reply can happen long after the
 * 30-second Reply window.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug, id } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: {
      id: true,
      ownerId: true,
      lineChannelAccessToken: true,
      lineWebhookEnabled: true,
    },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);
  if (!shop.lineChannelAccessToken || !shop.lineWebhookEnabled) {
    return fail(
      "line_not_configured",
      "ตั้งค่า LINE Messaging API ก่อนใช้งาน",
      400,
    );
  }

  const parsed = await parseJson(request, ReplyBody);
  if (!parsed.ok) return parsed.response;
  const { text } = parsed.data;

  const conversation = await db.conversation.findUnique({
    where: { id },
    select: { id: true, shopId: true, customerLineUserId: true },
  });
  if (!conversation || conversation.shopId !== shop.id)
    return fail("not_found", "ไม่พบบทสนทนา", 404);

  const result = await pushLineMessage({
    channelAccessToken: shop.lineChannelAccessToken,
    toUserId: conversation.customerLineUserId,
    text,
  });
  if (!result.ok) {
    return fail(
      "line_push_failed",
      `LINE push failed (${result.status}): ${result.error ?? "unknown"}`,
      502,
    );
  }

  const message = await db.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: ConversationMessageDirection.OUTBOUND,
      text,
    },
  });

  await db.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastMessageText: text,
    },
  });

  return ok({ message });
}
