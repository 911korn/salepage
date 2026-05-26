import { z } from "zod";
import { put } from "@vercel/blob";
import { ok, fail, parseJson } from "@/lib/api";
import { db, OrderStatus } from "@/lib/db";
import { verifySlip } from "@/lib/slip-verify";
import { sendOrderPaid, sendPaymentReceivedAlert } from "@/lib/email";
import { applyPaidOrderInventory, buildOrderRef } from "@/lib/orders";
import { notifyLineOrderUpdate } from "@/lib/line-order-notifications";
import { tryConsumeSlip } from "@/lib/slip-credits";
import { extractSlipQrPayloadFromBase64 } from "@/lib/slip-qr";
import {
  notifyOrderPaid,
  notifyShopNewOrder,
  resolveCustomerUserId,
} from "@/lib/push-notify";
import { createEscrowHoldOnPaid } from "@/lib/escrow";

interface Ctx {
  params: Promise<{ token: string }>;
}

export const runtime = "nodejs";

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

  const uploadedSlipUrl = await storeSlipImage({
    imageBase64: parsed.data.imageBase64,
    shopId: order.shop.id,
    orderId: order.id,
  });

  // Reserve a slip-verify call against the shop's plan quota / credit wallet
  // BEFORE hitting the SlipOK API (SlipOK charges per call regardless of
  // verification outcome). If exhausted, keep the uploaded slip on the order
  // and switch the customer into a manual-review flow instead of blocking them.
  const consume = await tryConsumeSlip(order.shop.id, order.shop.ownerId);
  if (!consume.ok) {
    const manualReason =
      consume.remaining.monthlyQuota === 0 && consume.remaining.credits === 0
        ? "no_auto_verify"
        : "slip_quota_exhausted";

    await db.order.update({
      where: { id: order.id },
      data: {
        slipImageUrl: uploadedSlipUrl ?? order.slipImageUrl,
        slipProvider: "manual",
        slipRaw: toJson({
          manualReview: true,
          reason: manualReason,
          submittedAt: new Date().toISOString(),
          remaining: consume.remaining,
          slipStored: Boolean(uploadedSlipUrl ?? order.slipImageUrl),
        }),
      },
    });

    return ok({
      verified: false,
      manualReview: true,
      status: order.status,
      reason: manualReason,
      message:
        "ร้านนี้ไม่ได้เปิดตรวจสลิปอัตโนมัติ ระบบรับสลิปไว้แล้วและรอร้านตรวจสอบด้วยมือ",
      slipImageUrl: uploadedSlipUrl ?? order.slipImageUrl,
      shopContact: buildShopContact(order.shop.contact),
      remaining: consume.remaining,
    });
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
      slipImageUrl: uploadedSlipUrl ?? order.slipImageUrl,
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

  // V1.5 Protected Pay: hold funds in escrow if the buyer opted in at checkout.
  // The hold sits at HELD until either (a) the buyer confirms receipt, (b) the
  // auto-release cron fires DELIVERED+72h, or (c) admin/dispute resolves it.
  // We intentionally hold the full `subtotalSatang + shippingSatang` (NOT the
  // escrow fee) — the fee accrues to the platform regardless of release path.
  if (order.useEscrow) {
    try {
      await createEscrowHoldOnPaid({
        orderId: order.id,
        amountSatang: order.subtotalSatang + order.shippingSatang,
        feeSatang: order.escrowFeeSatang,
      });
    } catch (e) {
      console.warn("[escrow] createEscrowHoldOnPaid failed:", e);
    }
  }

  void notifyLineOrderUpdate(updated);

  // Fire push notification (non-blocking) — fan-out to mobile devices
  void resolveCustomerUserId({
    customerLineUserId: order.customerLineUserId,
    customerEmail: order.customerEmail,
  }).then((customerUserId) =>
    notifyOrderPaid({
      customerUserId,
      orderToken: order.publicToken,
      shopName: order.shop.name,
      totalSatang: order.totalSatang,
    }),
  );

  // Push the shop owner — they're probably in the mobile seller dashboard
  // and the order needs to be fulfilled.
  void notifyShopNewOrder({
    shopOwnerUserId: order.shop.ownerId,
    orderToken: order.publicToken,
    totalSatang: order.totalSatang,
    itemCount: Array.isArray(order.items) ? order.items.length : 1,
    customerName: order.customerName,
  }).catch(() => undefined);

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

interface StoreSlipImageInput {
  imageBase64?: string;
  shopId: string;
  orderId: string;
}

async function storeSlipImage({
  imageBase64,
  shopId,
  orderId,
}: StoreSlipImageInput): Promise<string | null> {
  if (!imageBase64 || !process.env.BLOB_READ_WRITE_TOKEN) return null;

  try {
    const clean = imageBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
    const bytes = Buffer.from(clean, "base64");
    if (!bytes.byteLength || bytes.byteLength > 8 * 1024 * 1024) return null;

    const { contentType, extension } = sniffImageType(bytes);
    const result = await put(
      `slips/${shopId}/${orderId}/${Date.now()}.${extension}`,
      bytes,
      {
        access: "public",
        addRandomSuffix: false,
        contentType,
      },
    );
    return result.url;
  } catch {
    return null;
  }
}

function sniffImageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return { contentType: "image/png", extension: "png" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return { contentType: "image/jpeg", extension: "jpg" };
}

function buildShopContact(contact: unknown) {
  const parsed = contact as {
    phone?: string | null;
    line?: string | null;
  } | null;
  const phone = parsed?.phone?.trim() || null;
  const line = parsed?.line?.trim() || null;
  const phoneNumber = phone?.replace(/[^\d+]/g, "") || null;
  return {
    phone,
    phoneUrl: phoneNumber ? `tel:${phoneNumber}` : null,
    line,
    lineUrl: line ? buildLineUrl(line) : null,
  };
}

function buildLineUrl(line: string) {
  if (line.startsWith("http://") || line.startsWith("https://")) return line;
  return `https://line.me/R/ti/p/${line.startsWith("@") ? "%40" + line.slice(1) : line}`;
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
