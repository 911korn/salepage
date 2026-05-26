import { db, OrderStatus, type Prisma } from "@/lib/db";

/**
 * Shared "current user's orders" query. Single source of truth for the
 * mobile `/api/v1/me/orders` HTTP route AND the web `/me/orders` server
 * component (911korn 2026-05-27: "ทำให้มันใช้ api อันเดียวกัน · คอร์ส
 * แพลตฟอร์ม"). When we evolve the OR-matchers (email / lineUserId /
 * known-phone fallback) or the self-purchase exclusion, both surfaces
 * update together.
 */
export const ALLOWED_STATUSES = [
  "PENDING",
  "PAID",
  "SHIPPING",
  "DELIVERED",
  "CANCELLED",
] as const;
export type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

const PAGE_SIZE = 20;

interface MeOrdersInput {
  userId: string;
  status?: AllowedStatus | null;
  cursor?: string;
}

export interface MeOrderRow {
  token: string;
  status: string;
  shopName: string;
  shopSlug: string;
  totalSatang: number;
  createdAt: string;
}

export interface MeOrdersResult {
  orders: MeOrderRow[];
  counts: Record<string, number>;
  nextCursor: string | null;
}

export async function runMeOrdersQuery(input: MeOrdersInput): Promise<MeOrdersResult> {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, lineUserId: true },
  });
  if (!user) {
    return { orders: [], counts: {}, nextCursor: null };
  }

  const orMatchers: Prisma.OrderWhereInput["OR"] = [
    { customerEmail: user.email },
  ];
  if (user.lineUserId) {
    orMatchers.push({ customerLineUserId: user.lineUserId });
  }

  // Orphan recovery via known customerPhone — see /api/v1/me/orders for
  // the case study (korn4564 2026-05-27).
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
      customerEmail: null,
      customerLineUserId: null,
    });
  }

  // Exclude orders placed at the user's own shops — those belong in
  // /seller/orders only.
  const baseWhere: Prisma.OrderWhereInput = {
    OR: orMatchers,
    shop: { ownerId: { not: user.id } },
  };
  const where: Prisma.OrderWhereInput = {
    ...baseWhere,
    ...(input.status ? { status: input.status as OrderStatus } : {}),
  };

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      publicToken: true,
      status: true,
      totalSatang: true,
      createdAt: true,
      shop: { select: { slug: true, name: true } },
    },
  });

  const grouped = await db.order.groupBy({
    by: ["status"],
    where: baseWhere,
    _count: { status: true },
  });
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.status] = g._count.status;

  const hasMore = orders.length > PAGE_SIZE;
  const slice = hasMore ? orders.slice(0, PAGE_SIZE) : orders;
  return {
    orders: slice.map((o) => ({
      token: o.publicToken,
      status: o.status,
      shopName: o.shop.name,
      shopSlug: o.shop.slug,
      totalSatang: o.totalSatang,
      createdAt: o.createdAt.toISOString(),
    })),
    counts,
    nextCursor: hasMore ? slice[slice.length - 1]!.id : null,
  };
}
