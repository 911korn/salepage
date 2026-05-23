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
    token: order.publicToken,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    items: order.items,
    subtotalSatang: order.subtotalSatang,
    shippingSatang: order.shippingSatang,
    totalSatang: order.totalSatang,
    slipRef: order.slipRef,
    slipVerifiedAt: order.slipVerifiedAt,
    trackingNumber: order.trackingNumber,
    notes: order.notes,
    createdAt: order.createdAt,
    shop: order.shop,
    qr: qr
      ? { dataUrl: qr.dataUrl, payload: qr.payload, amount: qr.amount }
      : null,
  });
}
