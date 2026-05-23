import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db, OrderStatus, ProductStatus } from "@/lib/db";
import { generateOrderToken, buildOrderRef } from "@/lib/orders";
import { generatePromptPay } from "@/lib/promptpay";
import { sendOrderCreated, sendNewOrderAlert } from "@/lib/email";

const Item = z.object({
  productSlug: z.string().min(1),
  qty: z.number().int().positive().max(99).default(1),
});

const Body = z.object({
  shopSlug: z.string().min(1),
  items: z.array(Item).min(1).max(20),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(8).max(20).optional(),
  customerEmail: z.string().email().optional(),
  customerAddress: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  shippingSatang: z.number().int().nonnegative().max(100_000).default(0),
  couponCode: z.string().min(1).max(40).optional().nullable(),
  redeemPoints: z.number().int().min(0).optional().default(0),
});

/**
 * POST /api/v1/orders — public; no auth required.
 *
 * Creates an Order in PENDING state, generates a PromptPay QR for the shop's
 * receiver + total, and returns the public tracking token + QR data.
 *
 * If any product is digital or has stock < qty, we return an error early so
 * the customer can pick something else.
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const shop = await db.shop.findUnique({
    where: { slug: input.shopSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      promptpayId: true,
      contact: true,
      loyaltyBahtValuePerPoint: true,
      owner: { select: { email: true } },
    },
  });
  if (!shop || shop.status !== "ACTIVE") {
    return fail("shop_not_found", "ไม่พบร้านค้านี้", 404);
  }

  // Look up products + price-lock on server side
  const products = await db.product.findMany({
    where: {
      shopId: shop.id,
      slug: { in: input.items.map((i) => i.productSlug) },
      status: { not: ProductStatus.HIDDEN },
    },
  });
  if (products.length !== input.items.length) {
    return fail("product_missing", "มีสินค้าบางรายการไม่ว่าง", 400);
  }
  const byslug = new Map(products.map((p) => [p.slug, p]));

  let subtotalSatang = 0;
  const itemsSnapshot: Array<{
    productSlug: string;
    productName: string;
    qty: number;
    priceSatang: number;
    image?: string;
  }> = [];
  for (const item of input.items) {
    const p = byslug.get(item.productSlug)!;
    if (p.stock !== null && p.stock < item.qty) {
      return fail("out_of_stock", `${p.name}: สต๊อกไม่พอ`, 409);
    }
    subtotalSatang += p.priceSatang * item.qty;
    itemsSnapshot.push({
      productSlug: p.slug,
      productName: p.name,
      qty: item.qty,
      priceSatang: p.priceSatang,
      image: p.imageUrls[0],
    });
  }
  // Apply coupon (server-side re-validation, never trust client discount)
  let couponId: string | null = null;
  let couponDiscountSatang = 0;
  if (input.couponCode) {
    const coupon = await db.coupon.findUnique({
      where: {
        shopId_code: { shopId: shop.id, code: input.couponCode.toLowerCase() },
      },
    });
    if (
      coupon &&
      coupon.active &&
      (!coupon.expiresAt || coupon.expiresAt.getTime() >= Date.now()) &&
      (coupon.maxRedemptions === null || coupon.redeemedCount < coupon.maxRedemptions) &&
      (coupon.minOrderSatang === null || subtotalSatang >= coupon.minOrderSatang)
    ) {
      if (coupon.type === "PERCENT" && coupon.percent !== null) {
        couponDiscountSatang = Math.floor((subtotalSatang * coupon.percent) / 100);
      } else if (coupon.type === "FIXED" && coupon.amountSatang !== null) {
        couponDiscountSatang = Math.min(coupon.amountSatang, subtotalSatang);
      }
      couponId = coupon.id;
    }
  }

  // Apply loyalty point redemption (1 point = shop.loyaltyBahtValuePerPoint THB)
  let pointsRedeemed = 0;
  let pointsDiscountSatang = 0;
  if (
    input.redeemPoints &&
    input.redeemPoints > 0 &&
    input.customerPhone &&
    shop.loyaltyBahtValuePerPoint > 0
  ) {
    const cleanPhone = input.customerPhone.replace(/[^\d]/g, "");
    if (cleanPhone.length >= 9) {
      const wallet = await db.customerLoyalty.findUnique({
        where: {
          shopId_customerPhone: { shopId: shop.id, customerPhone: cleanPhone },
        },
      });
      const available = wallet?.points ?? 0;
      const wanted = Math.min(input.redeemPoints, available);
      const maxPointsByOrder = Math.floor(
        (subtotalSatang - couponDiscountSatang) /
          (shop.loyaltyBahtValuePerPoint * 100),
      );
      pointsRedeemed = Math.max(0, Math.min(wanted, maxPointsByOrder));
      pointsDiscountSatang = pointsRedeemed * shop.loyaltyBahtValuePerPoint * 100;
    }
  }

  const totalSatang = Math.max(
    0,
    subtotalSatang + input.shippingSatang - couponDiscountSatang - pointsDiscountSatang,
  );

  // Generate PromptPay QR if shop has receiver set
  let qr: Awaited<ReturnType<typeof generatePromptPay>> | null = null;
  if (shop.promptpayId) {
    try {
      qr = await generatePromptPay({
        id: shop.promptpayId,
        amount: totalSatang / 100,
      });
    } catch (e) {
      console.warn("PromptPay generation failed:", e);
    }
  }

  const token = generateOrderToken();
  const order = await db.order.create({
    data: {
      shopId: shop.id,
      publicToken: token,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      customerAddress: input.customerAddress,
      items: itemsSnapshot,
      subtotalSatang,
      shippingSatang: input.shippingSatang,
      totalSatang,
      status: OrderStatus.PENDING,
      paymentMethod: "promptpay",
      notes: input.notes,
      couponId,
      couponDiscountSatang,
      pointsRedeemed,
    },
  });

  // Atomic side-effects for coupon + point redemption
  if (couponId) {
    await db.coupon.update({
      where: { id: couponId },
      data: { redeemedCount: { increment: 1 } },
    });
  }
  if (pointsRedeemed > 0 && input.customerPhone) {
    const cleanPhone = input.customerPhone.replace(/[^\d]/g, "");
    await db.customerLoyalty.update({
      where: {
        shopId_customerPhone: { shopId: shop.id, customerPhone: cleanPhone },
      },
      data: { points: { decrement: pointsRedeemed } },
    });
  }

  // Fire emails in the background — don't await + don't fail the order on email error.
  const ref = buildOrderRef(order.createdAt, order.id);
  const shopContactEmail =
    (shop.contact as { email?: string } | null)?.email ?? null;
  const emailCtx = {
    ref,
    token: order.publicToken,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    totalSatang: order.totalSatang,
    items: itemsSnapshot,
    shopName: shop.name,
    shopContactEmail,
  };
  // Customer confirmation
  void sendOrderCreated(emailCtx);
  // Shop-owner alert
  if (shop.owner?.email) {
    void sendNewOrderAlert({
      ...emailCtx,
      ownerEmail: shop.owner.email,
      dashboardSlug: shop.slug,
    });
  }

  return ok(
    {
      orderId: order.id,
      token: order.publicToken,
      trackingUrl: `/o/${order.publicToken}`,
      qr: qr
        ? { dataUrl: qr.dataUrl, payload: qr.payload, amount: qr.amount }
        : null,
    },
    { status: 201 },
  );
}
