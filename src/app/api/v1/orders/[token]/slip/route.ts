import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db, OrderStatus } from "@/lib/db";
import { verifySlip } from "@/lib/slip-verify";
import { sendOrderPaid, sendPaymentReceivedAlert } from "@/lib/email";
import { buildOrderRef } from "@/lib/orders";

interface Ctx {
  params: Promise<{ token: string }>;
}

const Body = z
  .object({
    imageBase64: z.string().optional(),
    qrPayload: z.string().optional(),
  })
  .refine((v) => Boolean(v.imageBase64 || v.qrPayload), {
    message: "ส่ง imageBase64 หรือ qrPayload อย่างน้อย 1 อย่าง",
  });

/**
 * POST /api/v1/orders/:token/slip — public; customer uploads transfer slip.
 *
 * Flow:
 *  1. Load Order + shop (with promptpayId).
 *  2. If already PAID, return early — idempotent.
 *  3. Call provider (SlipOK in `log:false` multi-tenant mode by default).
 *  4. Manual checks our provider doesn't strictly enforce in log:false:
 *      - amount equals order total (within ±1 baht)
 *      - receiver tail matches shop's promptpayId
 *      - slipRef hasn't been used on another order in the same shop
 *  5. On success → update Order to PAID + persist slipRef + slipVerifiedAt.
 *  6. On any failure → return verified:false + reasons (the UI shows them).
 */
export async function POST(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          promptpayId: true,
          contact: true,
          owner: { select: { email: true } },
        },
      },
    },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);

  if (order.status !== OrderStatus.PENDING) {
    return ok({
      verified: order.status === OrderStatus.PAID ||
        order.status === OrderStatus.SHIPPING ||
        order.status === OrderStatus.DELIVERED,
      status: order.status,
      slipRef: order.slipRef,
      reason: "already_settled",
    });
  }

  const result = await verifySlip({
    imageBase64: parsed.data.imageBase64,
    qrPayload: parsed.data.qrPayload,
    expectAmount: order.totalSatang / 100,
    expectReceiverId: order.shop.promptpayId ?? undefined,
  });

  if (!result.verified) {
    return ok({
      verified: false,
      status: order.status,
      mismatch: result.mismatch ?? [
        { field: "receiver", expected: order.shop.promptpayId, got: null },
      ],
      provider: result.provider,
    });
  }

  // Duplicate-slip check per shop (log:false skips this server-side).
  if (result.ref) {
    const dup = await db.order.findFirst({
      where: {
        shopId: order.shop.id,
        slipRef: result.ref,
        id: { not: order.id },
      },
      select: { id: true, publicToken: true },
    });
    if (dup) {
      return ok({
        verified: false,
        status: order.status,
        mismatch: [{ field: "amount", expected: "unused-slip", got: "duplicate" }],
        duplicate: true,
        provider: result.provider,
      });
    }
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.PAID,
      slipRef: result.ref,
      slipVerifiedAt: new Date(),
      slipProvider: result.provider,
      slipRaw: result.raw
        ? JSON.parse(JSON.stringify(result.raw))
        : undefined,
    },
  });

  // Increment product.sold counters in the background (best-effort)
  const itemsArr = order.items as Array<{ productSlug: string; qty: number }>;
  await Promise.allSettled(
    itemsArr.map((it) =>
      db.product.update({
        where: { shopId_slug: { shopId: order.shop.id, slug: it.productSlug } },
        data: { sold: { increment: it.qty } },
      }),
    ),
  );

  // Fire email notifications (non-blocking, errors swallowed)
  const ref = buildOrderRef(order.createdAt, order.id);
  const shopContactEmail =
    (order.shop.contact as { email?: string } | null)?.email ?? null;
  // items snapshot was persisted as Json — re-read into the email-friendly shape
  const emailItems = (order.items as unknown as Array<{
    productName: string;
    qty: number;
    priceSatang: number;
  }>).map((it) => ({
    productName: it.productName,
    qty: it.qty,
    priceSatang: it.priceSatang,
  }));
  const emailCtx = {
    ref,
    token: order.publicToken,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    totalSatang: order.totalSatang,
    items: emailItems,
    shopName: order.shop.name,
    shopContactEmail,
    slipRef: updated.slipRef ?? undefined,
  };
  void sendOrderPaid(emailCtx);
  if (order.shop.owner?.email) {
    void sendPaymentReceivedAlert({
      ...emailCtx,
      ownerEmail: order.shop.owner.email,
    });
  }

  return ok({
    verified: true,
    status: updated.status,
    slipRef: updated.slipRef,
    transferredAt: result.transferredAt,
    sender: result.sender,
    receiver: result.receiver,
    provider: result.provider,
  });
}
