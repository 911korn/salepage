import { ok, fail } from "@/lib/api";
import { db, OrderStatus, EscrowStatus } from "@/lib/db";
import { releaseEscrowHold } from "@/lib/escrow";
import { sendOrderAutoDelivered } from "@/lib/email";
import { notifyLineOrderUpdate } from "@/lib/line-order-notifications";
import { buildOrderRef } from "@/lib/orders";

/**
 * GET /api/v1/cron/auto-mark-delivered
 *
 * Closes the SHIPPING → DELIVERED loop without a courier API. 911korn
 * 2026-05-27 "ระบบ Auto track ... จบ Loop เสมือนมี api เองเลย" — cheap
 * version: if a buyer doesn't click "ของถึงแล้ว" within 7 days of the
 * order entering SHIPPING, we flip it to DELIVERED on their behalf.
 *
 * Most parcels in Thailand land within 1-3 days. Seven days is the
 * Shopee-grade safety margin — plenty of room for stragglers (rural
 * deliveries, holidays, slow couriers) while still closing inventory
 * cleanly. The buyer can still open a dispute after auto-delivery if
 * the parcel never arrived.
 *
 * Per-run cap is 200 rows to bound the worst-case email burst.
 * Runs every 6 hours via vercel.json.
 */
const PER_RUN_CAP = 200;
const AUTO_DELIVER_DAYS = 7;

export async function GET(request: Request) {
  if (!authorized(request)) {
    return fail("unauthorized", "Cron auth required", 401);
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - AUTO_DELIVER_DAYS * 24 * 60 * 60 * 1000);

  // Find SHIPPING orders whose Shipment.shippedAt is older than 7 days.
  // We deliberately key off Shipment.shippedAt (set by the OCR receipt
  // route + by the seller's manual mark-as-shipped action) instead of
  // Order.updatedAt — that field changes on every coupon / address /
  // status touch and would flip orders prematurely.
  const candidates = await db.order.findMany({
    where: {
      status: OrderStatus.SHIPPING,
      shipment: {
        shippedAt: { lte: cutoff },
      },
    },
    take: PER_RUN_CAP,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      publicToken: true,
      createdAt: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      customerLineUserId: true,
      customerAddress: true,
      items: true,
      totalSatang: true,
      useEscrow: true,
      shop: {
        select: {
          slug: true,
          name: true,
          ownerId: true,
          contact: true,
        },
      },
      shipment: { select: { id: true } },
      escrow: { select: { id: true, status: true, amountSatang: true } },
    },
  });

  let delivered = 0;
  for (const order of candidates) {
    try {
      await db.$transaction([
        db.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.DELIVERED,
            buyerConfirmedAt: now,
          },
        }),
        ...(order.shipment
          ? [
              db.shipment.update({
                where: { id: order.shipment.id },
                data: { status: "DELIVERED", deliveredAt: now },
              }),
            ]
          : []),
      ]);

      // Escrow: release on auto-deliver too. The 72h auto-release cron
      // would catch this eventually but releasing here keeps the seller
      // cashflow tighter + avoids double notifications.
      if (
        order.useEscrow &&
        order.escrow &&
        order.escrow.status === EscrowStatus.HELD
      ) {
        await releaseEscrowHold({
          holdId: order.escrow.id,
          reason: "auto_delivered_7d",
        }).catch((err) => console.warn("escrow release on auto-deliver:", err));
      }

      const ref = buildOrderRef(order.createdAt, order.id);
      void sendOrderAutoDelivered({
        ref,
        token: order.publicToken,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        totalSatang: order.totalSatang,
        items: (order.items as never) ?? [],
        shopName: order.shop.name,
        shopContactEmail:
          (order.shop.contact as { email?: string } | null)?.email ?? null,
      });
      void notifyLineOrderUpdate({
        ...order,
        status: OrderStatus.DELIVERED,
        trackingNumber: null,
      });
      delivered++;
    } catch (err) {
      console.error(`auto-mark-delivered failed for ${order.publicToken}:`, err);
    }
  }

  return ok({
    scanned: candidates.length,
    delivered,
    cutoff: cutoff.toISOString(),
    runAt: now.toISOString(),
  });
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (request.headers.get("x-vercel-cron-signature")) return true;
  return false;
}
