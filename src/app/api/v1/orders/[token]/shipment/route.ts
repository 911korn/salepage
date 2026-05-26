import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, OrderStatus } from "@/lib/db";
import { sendOrderShipped } from "@/lib/email";
import { notifyLineOrderUpdate } from "@/lib/line-order-notifications";
import { buildOrderRef } from "@/lib/orders";
import { hasProPlan } from "@/lib/plan";
import { notifyOrderShipping, resolveCustomerUserId } from "@/lib/push-notify";
import {
  COURIER_OPTIONS,
  SHIPMENT_HANDOFFS,
  estimateShippingFeeSatang,
  getCourierOption,
  normalizeParcelWeightGram,
} from "@/lib/shipping";

interface Ctx {
  params: Promise<{ token: string }>;
}

const Body = z.object({
  courierCode: z.string().min(1).max(40),
  courierName: z.string().min(1).max(80).optional(),
  serviceName: z.string().max(80).optional().nullable(),
  handoff: z.enum(SHIPMENT_HANDOFFS).default("DROPOFF"),
  trackingNumber: z.string().max(80).optional().nullable(),
  senderName: z.string().max(120).optional().nullable(),
  senderPhone: z.string().max(30).optional().nullable(),
  senderAddress: z.string().max(500).optional().nullable(),
  senderPostcode: z.string().max(10).optional().nullable(),
  receiverName: z.string().max(120).optional().nullable(),
  receiverPhone: z.string().max(30).optional().nullable(),
  receiverAddress: z.string().max(500).optional().nullable(),
  receiverPostcode: z.string().max(10).optional().nullable(),
  parcelWeightGram: z.number().int().positive().max(50_000).optional().nullable(),
  parcelWidthCm: z.number().int().positive().max(300).optional().nullable(),
  parcelLengthCm: z.number().int().positive().max(300).optional().nullable(),
  parcelHeightCm: z.number().int().positive().max(300).optional().nullable(),
  shippingFeeSatang: z.number().int().nonnegative().max(100_000).optional().nullable(),
  codAmountSatang: z.number().int().nonnegative().max(1_000_000).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  markShipping: z.boolean().optional().default(false),
});

export async function GET(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  if (!(await hasProPlan(session.user.id))) {
    return fail(
      "plan_required",
      "Auto Shipping ใช้ได้เฉพาะแพ็กเกจ Pro ขึ้นไป",
      402,
      { requiredPlan: "PRO" },
    );
  }

  const { token } = await ctx.params;
  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: {
      shipment: true,
      shop: { select: { ownerId: true } },
    },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);
  if (order.shop.ownerId !== session.user.id) {
    return fail("forbidden", "ไม่มีสิทธิ์", 403);
  }

  return ok({
    shipment: order.shipment,
    couriers: COURIER_OPTIONS,
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  if (!(await hasProPlan(session.user.id))) {
    return fail(
      "plan_required",
      "Auto Shipping ใช้ได้เฉพาะแพ็กเกจ Pro ขึ้นไป",
      402,
      { requiredPlan: "PRO" },
    );
  }

  const { token } = await ctx.params;
  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: { shop: { select: { id: true, ownerId: true, name: true, slug: true, contact: true } } },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);
  if (order.shop.ownerId !== session.user.id) {
    return fail("forbidden", "ไม่มีสิทธิ์", 403);
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  if (order.status === OrderStatus.PENDING && input.markShipping) {
    return fail("payment_required", "ต้องยืนยันชำระเงินก่อนจัดส่ง", 409);
  }
  if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
    return fail("order_closed", "ออเดอร์นี้ปิดแล้ว", 409);
  }
  if (order.status === OrderStatus.DELIVERED && input.markShipping) {
    return fail("order_delivered", "ออเดอร์นี้ส่งสำเร็จแล้ว", 409);
  }
  const trackingNumber = input.trackingNumber?.trim() || null;
  if (input.markShipping && !trackingNumber) {
    return fail("tracking_required", "กรุณาใส่เลขพัสดุก่อนเริ่มจัดส่ง", 422);
  }

  const courier = getCourierOption(input.courierCode);
  const now = new Date();
  const shouldMarkShipping = input.markShipping && order.status !== OrderStatus.SHIPPING;
  const shipmentStatus = trackingNumber ? "IN_TRANSIT" : "READY_TO_SHIP";
  const labelUrl = `/dashboard/orders/${token}/label`;
  const parcelWeightGram = normalizeParcelWeightGram(input.parcelWeightGram);
  const shippingFeeSatang =
    input.shippingFeeSatang ??
    estimateShippingFeeSatang(input.courierCode, parcelWeightGram);

  const result = await db.$transaction(async (tx) => {
    const shipment = await tx.shipment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        shopId: order.shop.id,
        provider: "manual",
        courierCode: input.courierCode,
        courierName: input.courierName?.trim() || courier.name,
        serviceName: input.serviceName?.trim() || courier.serviceName,
        handoff: input.handoff,
        status: shipmentStatus,
        trackingNumber,
        labelUrl,
        senderName: input.senderName?.trim() || order.shop.name,
        senderPhone: input.senderPhone?.trim() || null,
        senderAddress: input.senderAddress?.trim() || null,
        senderPostcode: input.senderPostcode?.trim() || null,
        receiverName: input.receiverName?.trim() || order.customerName,
        receiverPhone: input.receiverPhone?.trim() || order.customerPhone,
        receiverAddress: input.receiverAddress?.trim() || order.customerAddress,
        receiverPostcode: input.receiverPostcode?.trim() || null,
        parcelWeightGram,
        parcelWidthCm: input.parcelWidthCm ?? null,
        parcelLengthCm: input.parcelLengthCm ?? null,
        parcelHeightCm: input.parcelHeightCm ?? null,
        shippingFeeSatang,
        codAmountSatang: input.codAmountSatang ?? null,
        note: input.note?.trim() || null,
        bookedAt: now,
        shippedAt: input.markShipping ? now : null,
      },
      update: {
        courierCode: input.courierCode,
        courierName: input.courierName?.trim() || courier.name,
        serviceName: input.serviceName?.trim() || courier.serviceName,
        handoff: input.handoff,
        status: shipmentStatus,
        trackingNumber,
        labelUrl,
        senderName: input.senderName?.trim() || order.shop.name,
        senderPhone: input.senderPhone?.trim() || null,
        senderAddress: input.senderAddress?.trim() || null,
        senderPostcode: input.senderPostcode?.trim() || null,
        receiverName: input.receiverName?.trim() || order.customerName,
        receiverPhone: input.receiverPhone?.trim() || order.customerPhone,
        receiverAddress: input.receiverAddress?.trim() || order.customerAddress,
        receiverPostcode: input.receiverPostcode?.trim() || null,
        parcelWeightGram,
        parcelWidthCm: input.parcelWidthCm ?? null,
        parcelLengthCm: input.parcelLengthCm ?? null,
        parcelHeightCm: input.parcelHeightCm ?? null,
        shippingFeeSatang,
        codAmountSatang: input.codAmountSatang ?? null,
        note: input.note?.trim() || null,
        shippedAt: input.markShipping ? now : undefined,
      },
    });

    const updatedOrder =
      input.markShipping || trackingNumber !== order.trackingNumber
        ? await tx.order.update({
            where: { id: order.id },
            data: {
              ...(input.markShipping ? { status: OrderStatus.SHIPPING } : {}),
              trackingNumber,
            },
            include: { shop: { select: { name: true, slug: true, contact: true } } },
          })
        : await tx.order.findUniqueOrThrow({
            where: { id: order.id },
            include: { shop: { select: { name: true, slug: true, contact: true } } },
          });

    return { shipment, order: updatedOrder };
  });

  if (shouldMarkShipping && result.order.customerEmail) {
    const items = result.order.items as Array<{
      productName: string;
      qty: number;
      priceSatang: number;
    }>;
    void sendOrderShipped({
      ref: buildOrderRef(result.order.createdAt, result.order.id),
      token: result.order.publicToken,
      customerName: result.order.customerName,
      customerEmail: result.order.customerEmail,
      totalSatang: result.order.totalSatang,
      items,
      shopName: result.order.shop.name,
      shopContactEmail:
        (result.order.shop.contact as { email?: string } | null)?.email ?? null,
      trackingNumber: result.order.trackingNumber,
    });
  }

  if (shouldMarkShipping || trackingNumber !== order.trackingNumber) {
    void notifyLineOrderUpdate(result.order);
  }

  // Push notify customer's mobile device once we flip into SHIPPING.
  // Only on the actual transition (not on subsequent tracking-number tweaks).
  if (shouldMarkShipping) {
    void resolveCustomerUserId({
      customerLineUserId: result.order.customerLineUserId,
      customerEmail: result.order.customerEmail,
    }).then((customerUserId) =>
      notifyOrderShipping({
        customerUserId,
        orderToken: result.order.publicToken,
        shopName: result.order.shop.name,
        courierName:
          input.courierName?.trim() || courier.name || "พัสดุ",
        trackingNumber: result.order.trackingNumber ?? "",
      }),
    );
  }

  return ok(result);
}
