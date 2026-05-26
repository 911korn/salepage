import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db, OrderStatus, ProductStatus } from "@/lib/db";
import { generateOrderToken, buildOrderRef } from "@/lib/orders";
import { generatePromptPay } from "@/lib/promptpay";
import { computeEscrowFeeSatang } from "@/lib/escrow-provider";
import { sendOrderCreated } from "@/lib/email";
import { verifyPlatformLineIdToken } from "@/lib/line";
import { getPlatformSetting } from "@/lib/platform-settings";
import { viewerCanBypassMaintenance } from "@/lib/admin";
import { normalizeCustomerPhone } from "@/lib/customer-addresses";
import { optionalSession } from "@/lib/api-auth";

/**
 * POST /api/v1/orders/multi — public; no auth required.
 *
 * Cross-shop checkout (V1.0). The cart UI calls this once with all selected
 * shops; we create N PENDING orders inside a single transaction (all-or-nothing
 * so the user never sees a half-confirmed cart) and return one PromptPay QR
 * per shop. The customer then settles each order independently — the slip
 * verification flow is per-order so each shop's funds stay direct.
 *
 * Why multiple QRs (not one merged): every shop has its own promptpayId, and
 * the platform never custodies funds. Merging would require an escrow account
 * which negates SalePage's 0% commission positioning.
 *
 * Coupons + loyalty + address autocomplete are deliberately NOT supported here
 * for V1.0 — they're shop-scoped, so a multi-shop bag would need per-shop
 * inputs. We'll layer those onto a follow-up endpoint once UX is validated.
 */
const Item = z.object({
  productSlug: z.string().min(1),
  qty: z.number().int().positive().max(99).default(1),
});

const ShopOrderInput = z.object({
  shopSlug: z.string().min(1),
  items: z.array(Item).min(1).max(20),
  /** Optional per-shop note (e.g. "ใส่หลอดให้ด้วย"). */
  notes: z.string().max(500).optional(),
  /**
   * V1.5 Protected Pay opt-in per-shop. Each shop in the cart independently
   * opts in or out — the buyer's checkout UI surfaces a toggle per row.
   * 422 if a shop with `acceptsEscrow=false` is asked to enable.
   */
  useEscrow: z.boolean().optional().default(false),
  /**
   * V1.1 per-shop coupon. Server re-validates against the shop's coupon
   * catalog and silently ignores invalid codes (mirrors single-shop /orders
   * behaviour so a typo on one shop doesn't fail the whole batch).
   */
  couponCode: z.string().min(1).max(40).optional().nullable(),
  /**
   * V1.1 per-shop loyalty redemption. 1 point = `shop.loyaltyBahtValuePerPoint` THB.
   * Requires `customerPhone` at top level — wallet is keyed by phone.
   */
  redeemPoints: z.number().int().min(0).optional().default(0),
});

const Body = z.object({
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(8).max(20).optional(),
  customerEmail: z.string().email().optional(),
  customerAddress: z.string().max(500).optional(),
  /** 1..10 shops per checkout — keeps the response small + transaction fast. */
  shops: z.array(ShopOrderInput).min(1).max(10),
  /** Platform LINE id token if buyer is signed-in via LIFF. */
  lineIdToken: z.string().min(10).max(5000).optional(),
  /**
   * V1.6: affiliate attribution applies to every Order created by this
   * multi-shop checkout. Same `referrerUserId` is written to all child
   * Order rows so the sharer gets credit for the whole bag.
   */
  referrerUserId: z.string().min(3).max(50).optional(),
  referrerCode: z.string().min(1).max(60).optional(),
});

interface ShopOrderResult {
  shopSlug: string;
  shopName: string;
  orderId: string;
  token: string;
  trackingUrl: string;
  totalSatang: number;
  qr: { dataUrl: string; payload: string; amount: number } | null;
}

export async function POST(request: Request) {
  const maintenance = await getPlatformSetting("maintenance_mode");
  if (maintenance.enabled) {
    const canBypass = await viewerCanBypassMaintenance(maintenance.allowedRoles);
    if (!canBypass) return fail("maintenance_mode", maintenance.message, 503);
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Opportunistic session — see /orders/route.ts for context. Signed-in
  // multi-shop checkouts get tagged so /me/orders surfaces them.
  const sessionUser = await optionalSession(request);
  const effectiveCustomerEmail =
    input.customerEmail ?? sessionUser?.email ?? undefined;

  // Reject duplicate shopSlug entries (clients should merge before posting).
  const slugs = input.shops.map((s) => s.shopSlug);
  if (new Set(slugs).size !== slugs.length) {
    return fail("duplicate_shop", "มี shopSlug ซ้ำในคำสั่งซื้อ", 422);
  }

  const normalizedCustomerPhone = input.customerPhone
    ? normalizeCustomerPhone(input.customerPhone)
    : undefined;

  // Resolve LINE profile once — applies to every order in the batch.
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

  // Load all shops in one query
  const shops = await db.shop.findMany({
    where: { slug: { in: slugs } },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      suspended: true,
      promptpayId: true,
      contact: true,
      acceptsEscrow: true,
      // V1.1 per-shop loyalty config — pulled so we can preview + apply
      // redemption without a second round trip per shop.
      loyaltyBahtValuePerPoint: true,
      owner: { select: { email: true } },
    },
  });
  const shopBySlug = new Map(shops.map((s) => [s.slug, s]));
  for (const slug of slugs) {
    const shop = shopBySlug.get(slug);
    if (!shop || shop.status !== "ACTIVE" || shop.suspended) {
      return fail("shop_unavailable", `ร้าน ${slug} ไม่พร้อมขาย`, 409, { slug });
    }
  }

  // Load all products in one query (groupedByShop after).
  const allSlugs = input.shops.flatMap((s) =>
    s.items.map((it) => ({ shopSlug: s.shopSlug, productSlug: it.productSlug })),
  );
  const productsRaw = await db.product.findMany({
    where: {
      OR: allSlugs.map((p) => ({
        shop: { slug: p.shopSlug },
        slug: p.productSlug,
        status: { not: ProductStatus.HIDDEN },
      })),
    },
    include: { shop: { select: { slug: true } } },
  });

  // Validate + price-lock + build order data per shop. Bail early on any miss.
  interface PreparedOrder {
    shopId: string;
    shopSlug: string;
    shopName: string;
    shopContact: unknown;
    shopOwnerEmail: string | null;
    shopPromptpayId: string | null;
    publicToken: string;
    totalSatang: number;
    subtotalSatang: number;
    items: Array<{
      productId: string;
      productSlug: string;
      productName: string;
      qty: number;
      priceSatang: number;
      image?: string;
    }>;
    notes: string | undefined;
    useEscrow: boolean;
    escrowFeeSatang: number;
    // V1.1 coupon + loyalty per shop (lazy-applied; nulls when not used).
    couponId: string | null;
    couponDiscountSatang: number;
    pointsRedeemed: number;
    pointsDiscountSatang: number;
  }
  const cleanPhone = normalizedCustomerPhone
    ? normalizedCustomerPhone.replace(/[^\d]/g, "")
    : undefined;
  const prepared: PreparedOrder[] = [];
  for (const shopInput of input.shops) {
    const shop = shopBySlug.get(shopInput.shopSlug)!;
    const productsForShop = productsRaw.filter(
      (p) => p.shop.slug === shopInput.shopSlug,
    );
    if (productsForShop.length !== shopInput.items.length) {
      return fail(
        "product_missing",
        `ร้าน ${shop.name}: มีสินค้าบางรายการไม่พร้อมขาย`,
        409,
        { shopSlug: shopInput.shopSlug },
      );
    }
    const byslug = new Map(productsForShop.map((p) => [p.slug, p]));
    let subtotal = 0;
    const items: PreparedOrder["items"] = [];
    for (const it of shopInput.items) {
      const p = byslug.get(it.productSlug);
      if (!p) {
        return fail(
          "product_missing",
          `ร้าน ${shop.name}: ไม่พบสินค้า ${it.productSlug}`,
          409,
          { shopSlug: shopInput.shopSlug, productSlug: it.productSlug },
        );
      }
      if (p.stock !== null && p.stock < it.qty) {
        return fail(
          "out_of_stock",
          `${p.name}: สต๊อกไม่พอ`,
          409,
          { shopSlug: shopInput.shopSlug, productSlug: it.productSlug },
        );
      }
      subtotal += p.priceSatang * it.qty;
      items.push({
        productId: p.id,
        productSlug: p.slug,
        productName: p.name,
        qty: it.qty,
        priceSatang: p.priceSatang,
        image: p.imageUrls[0],
      });
    }
    // V1.1 per-shop coupon — same validation rules as the single-shop POST.
    // We never trust client-side discount calculations.
    let couponId: string | null = null;
    let couponDiscountSatang = 0;
    if (shopInput.couponCode) {
      const coupon = await db.coupon.findUnique({
        where: {
          shopId_code: {
            shopId: shop.id,
            code: shopInput.couponCode.toLowerCase(),
          },
        },
      });
      if (
        coupon &&
        coupon.active &&
        (!coupon.expiresAt || coupon.expiresAt.getTime() >= Date.now()) &&
        (coupon.maxRedemptions === null ||
          coupon.redeemedCount < coupon.maxRedemptions) &&
        (coupon.minOrderSatang === null || subtotal >= coupon.minOrderSatang)
      ) {
        if (coupon.type === "PERCENT" && coupon.percent !== null) {
          couponDiscountSatang = Math.floor((subtotal * coupon.percent) / 100);
        } else if (coupon.type === "FIXED" && coupon.amountSatang !== null) {
          couponDiscountSatang = Math.min(coupon.amountSatang, subtotal);
        }
        couponId = coupon.id;
      }
    }

    // V1.1 per-shop loyalty redemption. Wallet is keyed by phone — without
    // phone the buyer can't burn points (the single-shop route enforces the
    // same rule).
    let pointsRedeemed = 0;
    let pointsDiscountSatang = 0;
    if (
      shopInput.redeemPoints &&
      shopInput.redeemPoints > 0 &&
      cleanPhone &&
      cleanPhone.length >= 9 &&
      shop.loyaltyBahtValuePerPoint > 0
    ) {
      const wallet = await db.customerLoyalty.findUnique({
        where: {
          shopId_customerPhone: {
            shopId: shop.id,
            customerPhone: cleanPhone,
          },
        },
      });
      const available = wallet?.points ?? 0;
      const wanted = Math.min(shopInput.redeemPoints, available);
      const maxPointsByOrder = Math.floor(
        (subtotal - couponDiscountSatang) /
          (shop.loyaltyBahtValuePerPoint * 100),
      );
      pointsRedeemed = Math.max(0, Math.min(wanted, maxPointsByOrder));
      pointsDiscountSatang =
        pointsRedeemed * shop.loyaltyBahtValuePerPoint * 100;
    }

    const totalBeforeEscrow = Math.max(
      0,
      subtotal - couponDiscountSatang - pointsDiscountSatang,
    );

    // V1.5: per-shop Protected Pay. Reject early if the shop opted out so the
    // caller can re-render the cart without surprise charges at QR time.
    if (shopInput.useEscrow && !shop.acceptsEscrow) {
      return fail(
        "escrow_not_accepted",
        `ร้าน ${shop.name} ไม่รองรับ Protected Pay`,
        409,
        { shopSlug: shopInput.shopSlug },
      );
    }
    const escrowFeeSatang = shopInput.useEscrow
      ? computeEscrowFeeSatang(totalBeforeEscrow)
      : 0;
    prepared.push({
      shopId: shop.id,
      shopSlug: shop.slug,
      shopName: shop.name,
      shopContact: shop.contact,
      shopOwnerEmail: shop.owner?.email ?? null,
      shopPromptpayId: shop.promptpayId,
      publicToken: generateOrderToken(),
      totalSatang: totalBeforeEscrow + escrowFeeSatang,
      subtotalSatang: subtotal,
      items,
      notes: shopInput.notes,
      useEscrow: shopInput.useEscrow,
      escrowFeeSatang,
      couponId,
      couponDiscountSatang,
      pointsRedeemed,
      pointsDiscountSatang,
    });
  }

  // Generate QR per shop in parallel (don't fail the batch if one shop has no
  // promptpayId — that order just returns qr:null and the customer contacts
  // the shop directly).
  const qrs = await Promise.all(
    prepared.map(async (p) => {
      if (!p.shopPromptpayId) return null;
      try {
        return await generatePromptPay({
          id: p.shopPromptpayId,
          amount: p.totalSatang / 100,
        });
      } catch (e) {
        console.warn(`PromptPay gen failed for ${p.shopSlug}:`, e);
        return null;
      }
    }),
  );

  // All-or-nothing creation. Stock decrements happen on PAID transition (same
  // path as single-shop), so the transaction here is just the Order rows.
  const created = await db.$transaction(
    prepared.map((p) =>
      db.order.create({
        data: {
          shopId: p.shopId,
          publicToken: p.publicToken,
          customerName: input.customerName.trim(),
          customerPhone: normalizedCustomerPhone || input.customerPhone,
          customerEmail: effectiveCustomerEmail,
          customerAddress: input.customerAddress,
          notes: p.notes,
          items: p.items,
          subtotalSatang: p.subtotalSatang,
          shippingSatang: 0,
          totalSatang: p.totalSatang,
          paymentMethod: "promptpay",
          status: OrderStatus.PENDING,
          // V1.6: same attribution written to every child order. Multi-shop
          // bags credit the same sharer for all shops in the cart.
          referrerUserId: input.referrerUserId?.trim() || null,
          referrerCode: input.referrerCode?.trim() || null,
          useEscrow: p.useEscrow,
          escrowFeeSatang: p.escrowFeeSatang,
          // V1.1 per-shop coupon + loyalty. We persist on the Order row so the
          // shop owner's dashboard sees the same discount breakdown a single-
          // shop order would show, and the post-create increment/decrement
          // below stays idempotent on retries.
          couponId: p.couponId,
          couponDiscountSatang: p.couponDiscountSatang,
          pointsRedeemed: p.pointsRedeemed,
          // Stamp LINE userId from either the freshly-verified idToken or
          // the cached session, so /me/orders' OR-match recovers the row
          // even if customerEmail attachment fails downstream.
          ...(lineProfile
            ? {
                customerLineUserId: lineProfile.sub,
                customerLineDisplayName: lineProfile.name ?? null,
                customerLinePictureUrl: lineProfile.picture ?? null,
                lineLinkedAt: new Date(),
              }
            : sessionUser?.lineUserId
              ? {
                  customerLineUserId: sessionUser.lineUserId,
                  lineLinkedAt: new Date(),
                }
              : {}),
        },
      }),
    ),
  );

  // V1.1 atomic side-effects per shop. Mirrors the single-shop post-create
  // path so coupon redeemed counts + loyalty balances stay consistent.
  for (const p of prepared) {
    if (p.couponId) {
      await db.coupon
        .update({
          where: { id: p.couponId },
          data: { redeemedCount: { increment: 1 } },
        })
        .catch((err) =>
          console.warn(
            `[orders/multi] coupon increment failed for ${p.shopSlug}:`,
            err,
          ),
        );
    }
    if (p.pointsRedeemed > 0 && cleanPhone) {
      await db.customerLoyalty
        .update({
          where: {
            shopId_customerPhone: {
              shopId: p.shopId,
              customerPhone: cleanPhone,
            },
          },
          data: { points: { decrement: p.pointsRedeemed } },
        })
        .catch((err) =>
          console.warn(
            `[orders/multi] loyalty decrement failed for ${p.shopSlug}:`,
            err,
          ),
        );
    }
  }

  // Fire confirmation emails (best-effort; non-blocking)
  if (effectiveCustomerEmail) {
    for (let i = 0; i < created.length; i++) {
      const order = created[i]!;
      const p = prepared[i]!;
      void sendOrderCreated({
        ref: buildOrderRef(order.createdAt, order.id),
        token: order.publicToken,
        customerName: order.customerName,
        customerEmail: effectiveCustomerEmail,
        totalSatang: order.totalSatang,
        items: p.items,
        shopName: p.shopName,
        shopContactEmail:
          (p.shopContact as { email?: string } | null)?.email ?? null,
      });
    }
  }

  const results: ShopOrderResult[] = created.map((order, i) => {
    const p = prepared[i]!;
    const qr = qrs[i];
    return {
      shopSlug: p.shopSlug,
      shopName: p.shopName,
      orderId: order.id,
      token: order.publicToken,
      trackingUrl: `/o/${order.publicToken}`,
      totalSatang: order.totalSatang,
      qr: qr
        ? {
            dataUrl: qr.dataUrl,
            payload: qr.payload,
            // generatePromptPay returns amount as `number | undefined`, but we
            // always pass an explicit numeric amount above. Fall back to the
            // prepared total to satisfy the response contract regardless.
            amount: qr.amount ?? p.totalSatang / 100,
          }
        : null,
    };
  });

  return ok(
    {
      orders: results,
      grandTotalSatang: results.reduce((sum, r) => sum + r.totalSatang, 0),
    },
    { status: 201 },
  );
}
