import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db, OrderStatus } from "@/lib/db";
import { verifySlip } from "@/lib/slip-verify";
import { sendOrderPaid, sendPaymentReceivedAlert } from "@/lib/email";
import { applyPaidOrderInventory, buildOrderRef } from "@/lib/orders";
import { notifyLineOrderUpdate } from "@/lib/line-order-notifications";
import { tryConsumeSlip } from "@/lib/slip-credits";
import { extractSlipQrPayloadFromBase64 } from "@/lib/slip-qr";

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
          slug: true,
          name: true,
          promptpayId: true,
          contact: true,
          ownerId: true,
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

  // Reserve a slip-verify call against the shop's plan quota / credit wallet
  // BEFORE hitting the SlipOK API (SlipOK charges per call regardless of
  // verification outcome). If exhausted, return 402 so the customer's UI can
  // surface a "ติดต่อร้าน — โควต้าหมด" hint.
  const consume = await tryConsumeSlip(order.shop.id, order.shop.ownerId);
  if (!consume.ok) {
    return fail(
      "slip_quota_exhausted",
      "ร้านนี้ใช้โควต้าเช็คสลิปเดือนนี้หมดแล้ว เจ้าของร้านต้องเติมเครดิตก่อน",
      402,
      { remaining: consume.remaining },
    );
  }

  const qrPayload = parsed.data.qrPayload ??
    (await extractSlipQrPayloadFromBase64(parsed.data.imageBase64));

  const result = await verifySlip({
    imageBase64: parsed.data.imageBase64,
    qrPayload: qrPayload ?? undefined,
    expectAmount: order.totalSatang / 100,
    expectReceiverId: order.shop.promptpayId ?? undefined,
  });

  if (!result.verified) {
    return ok({
      verified: false,
      status: order.status,
      mismatch: result.mismatch ?? [],
      reason: result.errorCode ?? "verification_failed",
      message: result.errorMessage,
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
    include: { shop: { select: { name: true, slug: true } } },
  });

  await applyPaidOrderInventory(order);
  void notifyLineOrderUpdate(updated);

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
