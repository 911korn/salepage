import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, GroupBuyStatus, OrderStatus } from "@/lib/db";
import { parseTiers, priceForCurrentQty } from "@/lib/group-buy";
import { pushToUser } from "@/lib/push-notify";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/group-buys/:id/join — public.
 *
 * Atomic flow:
 *   1. Re-read campaign inside `$transaction` to catch races on the last spot.
 *   2. Reject if status != ACTIVE or deadline passed.
 *   3. Reject if maxQty would be exceeded.
 *   4. Compute lock price from current tiers.
 *   5. Create Order (PENDING) + GroupBuyMember row.
 *   6. Increment `currentQty`. If now >= minQty, flip to FILLED + `filledAt`.
 *
 * Response: `{ orderToken, currentQty, filled, qr }` — the caller continues
 * to `/checkout/[token]` to actually pay.
 */
const JoinBody = z.object({
  qty: z.number().int().min(1).max(50).default(1),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(8).max(20).optional(),
  customerEmail: z.string().email().optional(),
  customerAddress: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  shippingSatang: z.number().int().nonnegative().max(100_000).default(0),
  referrerUserId: z.string().min(3).max(50).optional(),
  referrerCode: z.string().min(1).max(60).optional(),
  /** Optional Protected Pay opt-in. Same semantics as a normal order. */
  useEscrow: z.boolean().optional().default(false),
});

export async function POST(request: Request, ctx: Ctx) {
  // Auth optional — anonymous joins allowed (matches normal order flow).
  void resolveSession;

  const { id } = await ctx.params;
  const parsed = await parseJson(request, JoinBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const gb = await db.groupBuy.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      deadline: true,
      minQty: true,
      maxQty: true,
      tiers: true,
      currentQty: true,
      shopId: true,
      productId: true,
      shop: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          suspended: true,
          ownerId: true,
          acceptsEscrow: true,
          promptpayId: true,
        },
      },
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          priceSatang: true,
          imageUrls: true,
          stock: true,
        },
      },
    },
  });
  if (!gb) return fail("not_found", "ไม่พบ Group Buy นี้", 404);
  if (gb.shop.status !== "ACTIVE" || gb.shop.suspended) {
    return fail("shop_unavailable", "ร้านนี้ปิดอยู่", 409);
  }
  if (input.useEscrow && !gb.shop.acceptsEscrow) {
    return fail(
      "escrow_not_accepted",
      "ร้านนี้ไม่รองรับ Protected Pay",
      409,
    );
  }
  if (gb.status !== GroupBuyStatus.ACTIVE) {
    return fail("not_active", `Group Buy นี้สถานะ ${gb.status}`, 409);
  }
  if (gb.deadline.getTime() < Date.now()) {
    return fail("deadline_passed", "Group Buy หมดเวลาแล้ว", 409);
  }
  const wouldExceed =
    gb.maxQty !== null && gb.currentQty + input.qty > gb.maxQty;
  if (wouldExceed) {
    const remaining = (gb.maxQty ?? 0) - gb.currentQty;
    return fail(
      "max_qty_exceeded",
      `เหลืออีก ${remaining} ชิ้น เท่านั้น`,
      409,
      { remaining },
    );
  }
  if (gb.product.stock !== null && gb.product.stock < input.qty) {
    return fail("out_of_stock", `สต๊อกไม่พอ (เหลือ ${gb.product.stock})`, 409);
  }

  const tiers = parseTiers(gb.tiers);
  const unitPrice = priceForCurrentQty(
    tiers,
    gb.product.priceSatang,
    gb.currentQty,
  );
  const subtotal = unitPrice * input.qty;
  const escrowFeeSatang = input.useEscrow
    ? Math.ceil(((subtotal + input.shippingSatang) * 150) / 10_000)
    : 0;
  const totalSatang = subtotal + input.shippingSatang + escrowFeeSatang;

  const { generateOrderToken } = await import("@/lib/orders");
  const { generatePromptPay } = await import("@/lib/promptpay");
  const publicToken = generateOrderToken();
  let qr: Awaited<ReturnType<typeof generatePromptPay>> | null = null;
  if (gb.shop.promptpayId) {
    try {
      qr = await generatePromptPay({
        id: gb.shop.promptpayId,
        amount: totalSatang / 100,
      });
    } catch {
      // QR is best-effort; the buyer still gets the order to settle manually.
    }
  }

  const result = await db.$transaction(async (tx) => {
    const fresh = await tx.groupBuy.findUnique({
      where: { id },
      select: {
        status: true,
        currentQty: true,
        maxQty: true,
        deadline: true,
      },
    });
    if (!fresh || fresh.status !== GroupBuyStatus.ACTIVE) {
      throw Object.assign(new Error("not_active_in_tx"), { code: "race" });
    }
    if (fresh.deadline.getTime() < Date.now()) {
      throw Object.assign(new Error("deadline_passed_in_tx"), { code: "race" });
    }
    if (
      fresh.maxQty !== null &&
      fresh.currentQty + input.qty > fresh.maxQty
    ) {
      throw Object.assign(new Error("max_qty_in_tx"), { code: "race" });
    }

    const order = await tx.order.create({
      data: {
        shopId: gb.shopId,
        publicToken,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        customerAddress: input.customerAddress,
        notes: input.notes,
        items: [
          {
            productId: gb.product.id,
            productSlug: gb.product.slug,
            productName: gb.product.name,
            qty: input.qty,
            priceSatang: unitPrice,
            image: gb.product.imageUrls[0],
          },
        ],
        subtotalSatang: subtotal,
        shippingSatang: input.shippingSatang,
        totalSatang,
        status: OrderStatus.PENDING,
        paymentMethod: "promptpay",
        referrerUserId: input.referrerUserId?.trim() || null,
        referrerCode: input.referrerCode?.trim() || null,
        useEscrow: input.useEscrow,
        escrowFeeSatang,
      },
      select: { id: true, publicToken: true },
    });

    await tx.groupBuyMember.create({
      data: {
        groupBuyId: gb.id,
        orderId: order.id,
        qty: input.qty,
        priceLockedSatang: unitPrice,
      },
    });

    const updated = await tx.groupBuy.update({
      where: { id: gb.id },
      data: { currentQty: { increment: input.qty } },
      select: { currentQty: true, minQty: true },
    });

    let filled = false;
    if (updated.currentQty >= updated.minQty) {
      await tx.groupBuy.update({
        where: { id: gb.id },
        data: {
          status: GroupBuyStatus.FILLED,
          filledAt: new Date(),
        },
      });
      filled = true;
    }
    return { order, currentQty: updated.currentQty, filled };
  });

  if (result.filled) {
    void pushToUser(gb.shop.ownerId, {
      title: `🎉 Group Buy เต็มแล้ว!`,
      body: `${gb.product.name} — ${result.currentQty} ชิ้นพร้อมจัดส่ง`,
      data: {
        kind: "groupbuy.filled",
        groupBuyId: gb.id,
      },
    }).catch(() => undefined);
  }

  return ok(
    {
      orderToken: result.order.publicToken,
      currentQty: result.currentQty,
      filled: result.filled,
      qr: qr ? { dataUrl: qr.dataUrl, payload: qr.payload, amount: qr.amount } : null,
    },
    { status: 201 },
  );
}
