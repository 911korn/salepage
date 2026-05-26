import { resolveSession } from "@/lib/api-auth";
import { ok, fail } from "@/lib/api";
import { db, OrderStatus } from "@/lib/db";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/v1/shops/:slug/orders?status=PENDING|PAID|SHIPPING|DELIVERED|CANCELLED&cursor=<orderId>
 *
 * Shop-owner-only listing for the seller mobile dashboard. Returns the same
 * shape across status filters so the mobile screen can swap status tabs
 * without re-typing the row. We always return enough fields for the
 * one-tap actions (approve slip, mark shipping, etc.) so the dashboard
 * doesn't have to fetch the order detail again on tap.
 *
 * Auth: cookie session OR mobile Bearer JWT — both via `resolveSession`.
 */
const PAGE_SIZE = 20;

export async function GET(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);
  if (shop.ownerId !== session.user.id) {
    return fail("forbidden", "เฉพาะเจ้าของร้านเท่านั้น", 403);
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const cursor = searchParams.get("cursor");

  // Validate status filter against our enum — anything else => undefined so
  // we return all statuses (i.e. inbox view).
  const status =
    statusParam && statusParam in OrderStatus
      ? (statusParam as OrderStatus)
      : undefined;

  const orders = await db.order.findMany({
    where: {
      shopId: shop.id,
      ...(status ? { status } : {}),
    },
    take: PAGE_SIZE + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    // Owners want newest first, except in PENDING tab where the oldest is
    // most urgent (slip waiting for action). We branch the orderBy so the
    // UX matches the implicit prioritization sellers expect.
    orderBy:
      status === OrderStatus.PENDING
        ? { createdAt: "asc" }
        : { createdAt: "desc" },
    select: {
      id: true,
      publicToken: true,
      status: true,
      totalSatang: true,
      subtotalSatang: true,
      shippingSatang: true,
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      slipImageUrl: true,
      slipVerifiedAt: true,
      trackingNumber: true,
      createdAt: true,
      // Order.items is a Json snapshot at purchase time:
      // `Array<{ productId, productSlug, name, qty, priceSatang, image? }>`.
      // We pass it through unchanged — mobile parses it client-side.
      items: true,
    },
  });

  const hasMore = orders.length > PAGE_SIZE;
  const items = hasMore ? orders.slice(0, PAGE_SIZE) : orders;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return ok({ orders: items, nextCursor });
}
