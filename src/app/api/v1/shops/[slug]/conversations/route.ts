import { ok, fail } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  // Accept either web cookie OR mobile Bearer JWT — same data, two channels.
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true, lineWebhookEnabled: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const conversations = await db.conversation.findMany({
    where: { shopId: shop.id },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });

  return ok({
    conversations,
    lineWebhookEnabled: shop.lineWebhookEnabled,
  });
}
