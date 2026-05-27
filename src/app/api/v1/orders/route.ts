import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db, OrderStatus, ProductStatus } from "@/lib/db";
import { generateOrderToken, buildOrderRef } from "@/lib/orders";
import { generatePromptPay } from "@/lib/promptpay";
import { computeEscrowFeeSatang } from "@/lib/escrow-provider";
import { sendOrderCreated, sendNewOrderAlert } from "@/lib/email";
import { verifyPlatformLineIdToken } from "@/lib/line";
import { getPlatformSetting } from "@/lib/platform-settings";
import { viewerCanBypassMaintenance } from "@/lib/admin";
import { optionalSession } from "@/lib/api-auth";
import {
  extractThaiPostcode,
  makeAddressKey,
  makeAddressLabel,
  normalizeAddress,
  normalizeCustomerPhone,
} from "@/lib/customer-addresses";

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
  lineIdToken: z.string().min(10).max(5000).optional(),
  /** V1.5 affiliate ref — the SalePage user.id of whoever shared the link. */
  referrerUserId: z.string().min(3).max(50).optional(),
  /** Optional freeform campaign code, e.g. "yt-thaifood-may26". */
  referrerCode: z.string().min(1).max(60).optional(),
  /**
   * V1.5 Protected Pay (Escrow). When TRUE, the platform holds the funds
   * after slip-verify and releases on buyer-confirm OR DELIVERED+72h.
   * Adds a 1.5% buyer-paid fee to `totalSatang`. Shop must have
   * `acceptsEscrow=true` (defaults to TRUE).
   */
  useEscrow: z.boolean().optional().default(false),
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
  // Block new orders under maintenance mode (admins still pass through, so
  // the operator can validate the order flow end-to-end before unlocking).
  const maintenance = await getPlatformSetting("maintenance_mode");
  if (maintenance.enabled) {
    const canBypass = await viewerCanBypassMaintenance(maintenance.allowedRoles);
    if (!canBypass) {
      return fail("maintenance_mode", maintenance.message, 503);
    }
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  const normalizedCustomerPhone = input.customerPhone
    ? normalizeCustomerPhone(input.customerPhone)
    : undefined;

  // Opportunistic session — anonymous checkout is still allowed, but if the
  // buyer is signed in we tag the order with their email so it shows up in
  // /me/orders (911korn 2026-05-27 IMG_5250 "Order ที่ยังไม่ได้จ่ายหาไม่เจอ").
  const sessionUser = await optionalSession(request);
  const effectiveCustomerEmail =
    input.customerEmail ?? sessionUser?.email ?? undefined;

  const shop = await db.shop.findUnique({
    where: { slug: input.shopSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      suspended: true,
      promptpayId: true,
      contact: true,
      loyaltyBahtValuePerPoint: true,
      acceptsEscrow: true,
      owner: { select: { email: true } },
    },
  });
  if (!shop || shop.status !== "ACTIVE" || shop.suspended) {
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
  // V2.1 — recompute per-shop shipping fee from the products. One parcel
  // per shop, so we take MAX(item.shippingFeeSatang) across the line
  // items — adding 2 of the same product or mixing items in one order
  // never multiplies the shipping fee. Digital products contribute 0.
  // We deliberately ignore `input.shippingSatang` for trust: the buyer
  // sends what they were shown at cart, but the server is the source
  // of truth (911korn 2026-05-27 "ตอนแอด product มีช่องให้ระบุค่าส่ง").
  let shippingSatang = 0;
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
    if (p.type !== "DIGITAL") {
      shippingSatang = Math.max(shippingSatang, p.shippingFeeSatang ?? 0);
    }
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

  const totalBeforeEscrow = Math.max(
    0,
    subtotalSatang + shippingSatang - couponDiscountSatang - pointsDiscountSatang,
  );

  // V1.5 Protected Pay: validate shop opt-in + compute buyer-paid fee.
  // Fee is added on top of the post-discount total so the shop still receives
  // the full pre-fee amount (no platform commission charged on the seller side).
  if (input.useEscrow && !shop.acceptsEscrow) {
    return fail(
      "escrow_not_accepted",
      "ร้านนี้ไม่รองรับ Protected Pay — บีบตรงได้ตามปกติ",
      409,
    );
  }
  const escrowFeeSatang = input.useEscrow
    ? computeEscrowFeeSatang(totalBeforeEscrow)
    : 0;
  const totalSatang = totalBeforeEscrow + escrowFeeSatang;

  let lineProfile: Awaited<ReturnType<typeof verifyPlatformLineIdToken>> | null = null;
  if (input.lineIdToken) {
    try {
      lineProfile = await verifyPlatformLineIdToken(input.lineIdToken);
    } catch {
      return fail(
        "line_login_invalid",
        "LINE login หมดอายุ กรุณาเปิดหน้านี้ผ่าน LINE อีกครั้ง",
        401,
      );
    }
  }

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
      customerPhone: normalizedCustomerPhone || input.customerPhone,
      customerEmail: effectiveCustomerEmail,
      customerAddress: input.customerAddress,
      items: itemsSnapshot,
      subtotalSatang,
      shippingSatang,
      totalSatang,
      status: OrderStatus.PENDING,
      paymentMethod: "promptpay",
      notes: input.notes,
      couponId,
      couponDiscountSatang,
      pointsRedeemed,
      // Best-effort attribution — if the value looks bogus we still create
      // the order without it. We don't validate that referrerUserId points
      // to a real User because (a) self-referrals are rare and harmless and
      // (b) we don't want to leak User existence via a 422.
      referrerUserId: input.referrerUserId?.trim() || null,
      referrerCode: input.referrerCode?.trim() || null,
      useEscrow: input.useEscrow,
      escrowFeeSatang,
      // Prefer the lineIdToken claim (real LIFF profile from the buyer's
      // current LINE session) over the cached session.lineUserId — but fall
      // back to the latter so signed-in mobile buyers still get tagged even
      // when the cart doesn't forward a fresh idToken. This dual-source
      // attribution is what makes /me/orders recover orphaned rows whose
      // customerEmail somehow ended up null (911korn 2026-05-27 03:00).
      customerLineUserId: lineProfile?.sub ?? sessionUser?.lineUserId ?? undefined,
      customerLineDisplayName: lineProfile?.name,
      customerLinePictureUrl: lineProfile?.picture,
      lineLinkedAt:
        lineProfile || sessionUser?.lineUserId ? new Date() : undefined,
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

  if (input.customerPhone && input.customerAddress) {
    const cleanPhone = normalizeCustomerPhone(input.customerPhone);
    const cleanAddress = normalizeAddress(input.customerAddress);
    if (cleanPhone.length >= 9 && cleanAddress.length >= 10) {
      try {
        const addressKey = makeAddressKey(cleanAddress);
        await db.customerAddress.upsert({
          where: {
            shopId_customerPhone_addressKey: {
              shopId: shop.id,
              customerPhone: cleanPhone,
              addressKey,
            },
          },
          create: {
            shopId: shop.id,
            customerPhone: cleanPhone,
            customerName: input.customerName.trim(),
            label: makeAddressLabel(cleanAddress),
            address: cleanAddress,
            addressKey,
            postcode: extractThaiPostcode(cleanAddress),
          },
          update: {
            customerName: input.customerName.trim(),
            label: makeAddressLabel(cleanAddress),
            postcode: extractThaiPostcode(cleanAddress),
            useCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });
      } catch (e) {
        console.warn("Customer address memory failed:", e);
      }
    }
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
