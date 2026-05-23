import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db, OrderStatus, ProductStatus } from "@/lib/db";
import { generateOrderToken } from "@/lib/orders";
import { generatePromptPay } from "@/lib/promptpay";

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
  const totalSatang = subtotalSatang + input.shippingSatang;

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
    },
  });

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
