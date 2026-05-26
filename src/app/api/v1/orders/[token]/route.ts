import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { generatePromptPay } from "@/lib/promptpay";

interface Ctx {
  params: Promise<{ token: string }>;
}

/** GET /api/v1/orders/:token — public order tracking. */
export async function GET(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: {
      shop: {
        select: {
          slug: true,
          name: true,
          logoText: true,
          themeColor: true,
          promptpayId: true,
          contact: true,
        },
      },
      // V1.5 Protected Pay summary — null for legacy/non-escrow orders.
      escrow: {
        select: {
          status: true,
          amountSatang: true,
          feeSatang: true,
          scheduledReleaseAt: true,
          closeReason: true,
        },
      },
    },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);

  let qr: Awaited<ReturnType<typeof generatePromptPay>> | null = null;
  if (order.status === "PENDING" && order.shop.promptpayId) {
    try {
      qr = await generatePromptPay({
        id: order.shop.promptpayId,
        amount: order.totalSatang / 100,
      });
    } catch {
      /* swallow — UI will fallback to manual transfer info */
    }
  }

  return ok({
    // Web tracking-panel reads `token`; mobile reads `publicToken`. We
    // emit both so neither has to coordinate a rename.
    token: order.publicToken,
    publicToken: order.publicToken,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    lineLinked: Boolean(order.customerLineUserId),
    customerLineDisplayName: order.customerLineDisplayName,
    customerLinePictureUrl: order.customerLinePictureUrl,
    items: order.items,
    subtotalSatang: order.subtotalSatang,
    shippingSatang: order.shippingSatang,
    totalSatang: order.totalSatang,
    slipRef: order.slipRef,
    slipVerifiedAt: order.slipVerifiedAt,
    trackingNumber: order.trackingNumber,
    notes: order.notes,
    createdAt: order.createdAt,
    // V1.5 Protected Pay surface. `escrow` is null on non-escrow orders.
    useEscrow: order.useEscrow,
    escrowFeeSatang: order.escrowFeeSatang,
    buyerConfirmedAt: order.buyerConfirmedAt,
    escrow: order.escrow,
    shop: order.shop,
    qr: qr
      ? { dataUrl: qr.dataUrl, payload: qr.payload, amount: qr.amount }
      : null,
  });
}
