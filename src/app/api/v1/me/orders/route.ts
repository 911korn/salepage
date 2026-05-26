import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { resolveSession } from "@/lib/api-auth";

/**
 * GET /api/v1/me/orders?cursor=<orderId> — cross-shop order history.
 *
 * For V0.5 we match by `customerEmail` (= the LIFF/Login-derived email).
 * V1.0 will add Order.userId FK after a migration so anonymous-vs-logged-in
 * checkouts can be linked retroactively.
 */
const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { user } = session;

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const orders = await db.order.findMany({
    where: { customerEmail: user.email },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      publicToken: true,
      status: true,
      totalSatang: true,
      createdAt: true,
      shop: { select: { slug: true, name: true } },
    },
  });

  const hasMore = orders.length > PAGE_SIZE;
  const slice = hasMore ? orders.slice(0, PAGE_SIZE) : orders;
  return ok({
    orders: slice.map((o) => ({
      token: o.publicToken,
      status: o.status,
      shopName: o.shop.name,
      shopSlug: o.shop.slug,
      totalSatang: o.totalSatang,
      createdAt: o.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? slice[slice.length - 1]!.id : null,
  });
}
