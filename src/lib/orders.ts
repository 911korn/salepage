import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Public, URL-safe order token a customer can use to track / pay for an order
 * without authenticating. Stored on `Order.publicToken`.
 *
 * Format: 16 random bytes encoded as base64url (~22 chars).
 * Unguessable in practice and shorter than UUIDs.
 */
export function generateOrderToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Display-friendly order reference shown to the customer (e.g. "#A2391").
 * Built from the order's createdAt timestamp + a short random suffix so it's
 * monotonic-ish per day but uncoupled from the public token.
 */
export function buildOrderRef(date: Date, idSuffix: string): string {
  const ymd = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `#${ymd}-${idSuffix.toUpperCase().slice(-5)}`;
}

type InventoryOrder = {
  shopId: string;
  items: unknown;
};

type InventoryItem = {
  productSlug?: string;
  slug?: string;
  qty?: number;
};

export async function applyPaidOrderInventory(order: InventoryOrder) {
  const items = normalizeInventoryItems(order.items);
  if (items.length === 0) return;

  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  await db.$transaction(async (tx) => {
    for (const item of items) {
      const unlimited = await tx.product.updateMany({
        where: {
          shopId: order.shopId,
          slug: item.productSlug,
          stock: null,
        },
        data: { sold: { increment: item.qty } },
      });
      if (unlimited.count > 0) continue;

      const stocked = await tx.product.updateMany({
        where: {
          shopId: order.shopId,
          slug: item.productSlug,
          stock: { gte: item.qty },
        },
        data: {
          sold: { increment: item.qty },
          stock: { decrement: item.qty },
        },
      });
      if (stocked.count > 0) continue;

      await tx.product.updateMany({
        where: {
          shopId: order.shopId,
          slug: item.productSlug,
          stock: { not: null },
        },
        data: {
          sold: { increment: item.qty },
          stock: 0,
        },
      });
    }

    if (totalQty > 0) {
      await tx.shop.update({
        where: { id: order.shopId },
        data: { totalSold: { increment: totalQty } },
      });
    }
  });
}

function normalizeInventoryItems(items: unknown) {
  if (!Array.isArray(items)) return [];

  const bySlug = new Map<string, { productSlug: string; qty: number }>();
  for (const item of items as InventoryItem[]) {
    const productSlug = item.productSlug ?? item.slug;
    const qty = Math.max(0, Math.floor(Number(item.qty ?? 0)));
    if (!productSlug || qty <= 0) continue;

    const existing = bySlug.get(productSlug);
    if (existing) {
      existing.qty += qty;
    } else {
      bySlug.set(productSlug, { productSlug, qty });
    }
  }

  return [...bySlug.values()];
}
