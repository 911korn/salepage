import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, OrderStatus } from "@/lib/db";
import { hasProPlan } from "@/lib/plan";
import { buyLabel } from "@/lib/easyparcel";
import { extractThaiPostcode } from "@/lib/customer-addresses";
import { buildOrderRef } from "@/lib/orders";
import { sendOrderShipped } from "@/lib/email";
import { notifyLineOrderUpdate } from "@/lib/line-order-notifications";

/**
 * POST /api/v1/orders/[token]/shipment/buy
 *
 * Pro-gated. Confirms a rate quote (from POST /shipment/quote), buys
 * the label via EasyParcel, stores AWB + PDF URL on the Shipment row,
 * flips the order to SHIPPING, and notifies the buyer (email + LINE
 * push). Idempotent on retries — won't re-buy a label if one's
 * already on the Shipment.
 */
const Body = z.object({
  rateRef: z.string().min(1).max(120),
  courierCode: z.string().min(1).max(40),
  courierName: z.string().min(1).max(120),
  serviceName: z.string().max(120).optional(),
  weightGram: z.number().int().positive().max(50_000),
  widthCm: z.number().int().positive().max(300).optional(),
  lengthCm: z.number().int().positive().max(300).optional(),
  heightCm: z.number().int().positive().max(300).optional(),
  shippingFeeSatang: z.number().int().nonnegative().max(100_000),
  handoff: z.enum(["DROPOFF", "PICKUP"]).default("DROPOFF"),
  note: z.string().max(500).optional(),
});

interface Ctx {
  params: Promise<{ token: string }>;
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { token } = await ctx.params;
  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: {
      shop: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          slug: true,
          contact: true,
        },
      },
      shipment: true,
    },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);
  if (order.shop.ownerId !== session.user.id) {
    return fail("forbidden", "ไม่มีสิทธิ์", 403);
  }
  if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.SHIPPING) {
    return fail(
      "wrong_status",
      "ออกใบปะหน้าได้เฉพาะออเดอร์ที่ลูกค้าชำระเงินเรียบร้อยแล้ว",
      409,
    );
  }
  const isPro = await hasProPlan(session.user.id);
  if (!isPro) {
    return fail(
      "pro_required",
      "ออกใบปะหน้าอัตโนมัติเฉพาะแผน Pro+ — อัปเกรดที่ /billing",
      402,
    );
  }
  // Idempotent: if a label already exists, return it.
  if (order.shipment?.labelUrl && order.shipment?.trackingNumber) {
    return ok({
      awbNumber: order.shipment.trackingNumber,
      labelPdfUrl: order.shipment.labelUrl,
      providerOrderNo: order.shipment.providerShipmentId ?? null,
      reusedExisting: true,
    });
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const contact =
    order.shop.contact &&
    typeof order.shop.contact === "object" &&
    !Array.isArray(order.shop.contact)
      ? (order.shop.contact as {
          phone?: string;
          address?: string;
          postcode?: string;
        })
      : null;
  const senderPostcode =
    contact?.postcode ?? process.env.EASYPARCEL_SENDER_POSTCODE ?? "10110";
  const senderName = order.shop.name ?? "SalePage Seller";
  const senderPhone = contact?.phone ?? "0800000000";
  const senderAddress = contact?.address ?? "";

  const receiverPostcode = order.customerAddress
    ? extractThaiPostcode(order.customerAddress)
    : null;
  if (!receiverPostcode) {
    return fail(
      "missing_postcode",
      "ออเดอร์นี้ยังไม่มีรหัสไปรษณีย์ปลายทาง",
      422,
    );
  }

  const orderRef = buildOrderRef(order.createdAt, order.id);
  const label = await buyLabel({
    rateRef: input.rateRef,
    sender: {
      name: senderName,
      phone: senderPhone,
      address: senderAddress,
      postcode: senderPostcode,
    },
    receiver: {
      name: order.customerName,
      phone: order.customerPhone ?? "0800000000",
      address: order.customerAddress ?? "",
      postcode: receiverPostcode,
    },
    parcel: {
      weightGram: input.weightGram,
      widthCm: input.widthCm ?? 10,
      lengthCm: input.lengthCm ?? 10,
      heightCm: input.heightCm ?? 10,
    },
    handoff: input.handoff,
    orderRef,
  });

  const now = new Date();
  await db.$transaction([
    db.shipment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        shopId: order.shop.id,
        provider: "easyparcel",
        providerShipmentId: label.providerOrderNo,
        courierCode: input.courierCode,
        courierName: input.courierName,
        serviceName: input.serviceName ?? input.courierName,
        handoff: input.handoff,
        status: "READY_TO_SHIP",
        trackingNumber: label.awbNumber,
        labelUrl: label.labelPdfUrl,
        senderName,
        senderPhone,
        senderAddress,
        senderPostcode,
        receiverName: order.customerName,
        receiverPhone: order.customerPhone,
        receiverAddress: order.customerAddress,
        receiverPostcode,
        parcelWeightGram: input.weightGram,
        parcelWidthCm: input.widthCm ?? 10,
        parcelLengthCm: input.lengthCm ?? 10,
        parcelHeightCm: input.heightCm ?? 10,
        shippingFeeSatang: input.shippingFeeSatang,
        note: input.note ?? null,
        bookedAt: now,
      },
      update: {
        provider: "easyparcel",
        providerShipmentId: label.providerOrderNo,
        courierCode: input.courierCode,
        courierName: input.courierName,
        serviceName: input.serviceName ?? input.courierName,
        trackingNumber: label.awbNumber,
        labelUrl: label.labelPdfUrl,
        parcelWeightGram: input.weightGram,
        bookedAt: now,
      },
    }),
    db.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.SHIPPING,
        trackingNumber: label.awbNumber,
      },
    }),
  ]);

  const ref = buildOrderRef(order.createdAt, order.id);
  void sendOrderShipped({
    ref,
    token: order.publicToken,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    totalSatang: order.totalSatang,
    items: (order.items as never) ?? [],
    shopName: order.shop.name,
    shopContactEmail:
      (order.shop.contact as { email?: string } | null)?.email ?? null,
    trackingNumber: label.awbNumber,
  });
  void notifyLineOrderUpdate({
    ...order,
    status: OrderStatus.SHIPPING,
    trackingNumber: label.awbNumber,
  });

  return ok({
    awbNumber: label.awbNumber,
    labelPdfUrl: label.labelPdfUrl,
    providerOrderNo: label.providerOrderNo,
    courierName: input.courierName,
    reusedExisting: false,
  });
}
