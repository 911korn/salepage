import { ok, fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Sign in required", 401);

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
