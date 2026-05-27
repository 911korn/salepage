import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getRates } from "@/lib/easyparcel";
import { extractThaiPostcode } from "@/lib/customer-addresses";

/**
 * POST /api/v1/orders/[token]/shipment/quote
 *
 * Returns courier options + prices for shipping this order. The seller
 * picks one, then hits /shipment/buy (Phase 2) to commit. Owner-only
 * because rates depend on the shop's pickup postcode + shipping
 * preferences (911korn 2026-05-27 EasyParcel Shopee-style integration).
 *
 * Body: optional parcel overrides. If the seller hasn't measured yet
 * the route falls back to 500g/10x10x10cm — good enough for an initial
 * quote, refined when they confirm.
 */
const Body = z.object({
  weightGram: z.number().int().positive().max(50_000).optional(),
  widthCm: z.number().int().positive().max(300).optional(),
  lengthCm: z.number().int().positive().max(300).optional(),
  heightCm: z.number().int().positive().max(300).optional(),
  handoff: z.enum(["DROPOFF", "PICKUP"]).optional(),
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
    },
  });
  if (!order) return fail("not_found", "ไม่พบออเดอร์นี้", 404);
  if (order.shop.ownerId !== session.user.id) {
    return fail("forbidden", "ไม่มีสิทธิ์", 403);
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Sender = the shop's saved pickup info or platform fallback.
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
    contact?.postcode ??
    process.env.EASYPARCEL_SENDER_POSTCODE ??
    "10110";
  const senderName =
    process.env.EASYPARCEL_SENDER_NAME ?? order.shop.name ?? "SalePage";
  const senderPhone =
    contact?.phone ?? process.env.EASYPARCEL_SENDER_PHONE ?? "0800000000";
  const senderAddress = contact?.address ?? "SalePage HQ";

  // Receiver = the buyer. We need a real postcode to quote; surface a
  // friendly error if the order was placed without one.
  const receiverPostcode = order.customerAddress
    ? extractThaiPostcode(order.customerAddress)
    : null;
  if (!receiverPostcode) {
    return fail(
      "missing_postcode",
      "ออเดอร์นี้ยังไม่มีรหัสไปรษณีย์ปลายทาง — ลูกค้าต้องอัปเดตที่อยู่ก่อนเรียกราคา",
      422,
    );
  }

  const rates = await getRates({
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
      weightGram: input.weightGram ?? 500,
      widthCm: input.widthCm ?? 10,
      lengthCm: input.lengthCm ?? 10,
      heightCm: input.heightCm ?? 10,
    },
    handoff: input.handoff,
  });

  return ok({ rates });
}
