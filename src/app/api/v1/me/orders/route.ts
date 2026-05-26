import { ok, fail } from "@/lib/api";
import { db, OrderStatus, type Prisma } from "@/lib/db";
import { resolveSession } from "@/lib/api-auth";

/**
 * GET /api/v1/me/orders?status=<STATUS>&cursor=<orderId>
 *
 * Cross-shop order history. Two matchers OR'd together so signed-in buyers
 * see their orders even when the buyer flow forgot to attach
 * `customerEmail` at create-time:
 *   1. `customerEmail = user.email`
 *   2. `customerLineUserId = user.lineUserId` (if the user has linked LINE)
 *
 * Status filter is optional — omit for the "all" tab.
 */
const PAGE_SIZE = 20;
const VALID_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.SHIPPING,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { user } = session;

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const statusParam = url.searchParams.get("status") as OrderStatus | null;
  if (statusParam && !VALID_STATUSES.includes(statusParam)) {
    return fail("invalid_status", "Unknown order status", 400);
  }

  const orMatchers: Prisma.OrderWhereInput["OR"] = [
    { customerEmail: user.email },
  ];
  if (user.lineUserId) {
    orMatchers.push({ customerLineUserId: user.lineUserId });
  }

  // Soft third matcher: orders sharing a customerPhone the user has
  // previously checked out with. Recovers orphans whose customerEmail +
  // customerLineUserId both ended up null (e.g. orders placed before the
  // cart attached a Bearer token, then auto-cancelled 15 minutes later
  // by /api/v1/cron/expire-pending-orders). Phone is unique enough in
  // practice — duplicate-buyer collisions are vanishingly rare on TH
  // mobile numbers (911korn 2026-05-27 korn4564 case).
  const knownPhoneRows = await db.order.findMany({
    where: {
      customerEmail: user.email,
      customerPhone: { not: null },
    },
    select: { customerPhone: true },
    distinct: ["customerPhone"],
    take: 10,
  });
  const knownPhones = knownPhoneRows
    .map((r) => r.customerPhone)
    .filter((p): p is string => Boolean(p));
  if (knownPhones.length > 0) {
    orMatchers.push({
      customerPhone: { in: knownPhones },
      // Only claim orphans (rows with neither email nor lineUserId) so
      // we don't accidentally hijack another logged-in buyer's row that
      // happens to share a phone (e.g. shared household number).
      customerEmail: null,
      customerLineUserId: null,
    });
  }

  const where: Prisma.OrderWhereInput = {
    OR: orMatchers,
    ...(statusParam ? { status: statusParam } : {}),
  };

  const orders = await db.order.findMany({
    where,
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

  // Counts per status — drives the tab badges. Single grouped query, scoped
  // to the same OR matchers as the list so the buyer can see "you have 3
  // pending" without paginating.
  const grouped = await db.order.groupBy({
    by: ["status"],
    where: { OR: orMatchers },
    _count: { status: true },
  });
  const countByStatus: Record<string, number> = {};
  for (const g of grouped) countByStatus[g.status] = g._count.status;

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
    counts: countByStatus,
    nextCursor: hasMore ? slice[slice.length - 1]!.id : null,
  });
}
