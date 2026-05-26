import { resolveSession } from "@/lib/api-auth";
import { ok } from "@/lib/api";
import { db } from "@/lib/db";

/**
 * GET /api/v1/me/addresses
 *
 * Returns the distinct shipping addresses the current user has used across
 * any shop. We derive this from `Order` rows (cross-shop) and dedupe by
 * `(customerAddress, customerPhone)` so repeating the same address on three
 * shops shows up once.
 *
 * V1.5 is read-only. We expose it so mobile can show "เลือกจากที่อยู่ที่เคยใช้"
 * during checkout instead of forcing the user to retype.
 *
 * Future (V1.6+): dedicated `UserAddress` table with labels (Home/Office) and
 * a default flag, set via a write-back endpoint. The Order-derived view here
 * stays as a fallback even when that ships.
 */
const MAX_ADDRESSES = 10;
const LOOKBACK_ORDERS = 50;

export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { user } = session;

  // Look up by both LINE userId and email — orders attach the customer via
  // whichever channel the buyer used. The user can have either or both.
  const lineUserIds = await db.account
    .findMany({
      where: { userId: user.id, provider: "line" },
      select: { providerAccountId: true },
    })
    .then((rows) => rows.map((r) => r.providerAccountId));

  const customerWhere = {
    OR: [
      ...(user.email ? [{ customerEmail: user.email }] : []),
      ...(lineUserIds.length > 0
        ? [{ customerLineUserId: { in: lineUserIds } }]
        : []),
    ],
  };

  // No identity channels → empty list (anonymous account).
  if (customerWhere.OR.length === 0) {
    return ok({ addresses: [] });
  }

  const recentOrders = await db.order.findMany({
    where: {
      ...customerWhere,
      customerAddress: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: LOOKBACK_ORDERS,
    select: {
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      createdAt: true,
      shop: { select: { slug: true, name: true } },
    },
  });

  // Dedupe by (address, phone). Keep first occurrence (most recent thanks to
  // the orderBy above) so the freshest "lastUsedAt"+shop label sticks.
  const seen = new Map<
    string,
    {
      name: string;
      phone: string | null;
      address: string;
      lastUsedAt: Date;
      lastShop: { slug: string; name: string };
    }
  >();
  for (const o of recentOrders) {
    if (!o.customerAddress) continue;
    const key = `${o.customerAddress}|${o.customerPhone ?? ""}`;
    if (seen.has(key)) continue;
    seen.set(key, {
      name: o.customerName,
      phone: o.customerPhone,
      address: o.customerAddress,
      lastUsedAt: o.createdAt,
      lastShop: o.shop,
    });
    if (seen.size >= MAX_ADDRESSES) break;
  }

  return ok({
    addresses: Array.from(seen.values()).map((a, i) => ({
      id: `addr-${i}`, // deterministic id for React keys; not stable across queries
      name: a.name,
      phone: a.phone,
      address: a.address,
      lastUsedAt: a.lastUsedAt,
      lastShop: a.lastShop,
    })),
  });
}
