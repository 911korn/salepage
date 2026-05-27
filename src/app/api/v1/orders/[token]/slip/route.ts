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
    // Auto-verify failed AFTER we consumed quota — could be a SlipOK
    // service blip, an unusual slip format, or a real mismatch (wrong
    // amount / wrong receiver). We persist the slip image either way so
    // the seller can manually review in the dashboard, and we tell the
    // buyer that the slip is on file (911korn 2026-05-27 "ร้านฟรี ยัง
    // ขึ้นแบบเดิม" — bulletproof every failure path, not just the
    // pre-consume one). When the mismatch IS clearly the buyer's fault
    // (wrong amount or wrong receiver), we still surface that so they
    // can retry with the correct slip.
    const hasExplicitMismatch =
      Array.isArray(result.mismatch) && result.mismatch.length > 0;
    await db.order.update({
      where: { id: order.id },
      data: {
        slipImageUrl: uploadedSlipUrl ?? order.slipImageUrl,
        slipProvider: result.provider,
        slipRaw: toJson({
          autoVerifyFailed: true,
          reason: result.errorCode ?? "verification_failed",
          mismatch: result.mismatch ?? [],
          submittedAt: new Date().toISOString(),
        }),
      },
    });
    return ok({
      verified: false,
      // Soft-route to manual review when we can't pin the failure on the
      // buyer (no explicit amount/receiver mismatch). The mobile + web
      // checkout panels show a friendly "shop will review" message
      // instead of a "verification failed" alert.
      manualReview: !hasExplicitMismatch,
      status: order.status,
      mismatch: result.mismatch ?? [],
      reason: result.errorCode ?? "verification_failed",
      message: result.errorMessage,
      provider: result.provider,
      slipImageUrl: uploadedSlipUrl ?? order.slipImageUrl,
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

  // V2.1 digital fulfillment — snapshot the seller's pre-filled content
  // from every line item that's a DIGITAL product, joined into one block
  // separated by line-item headers. Done BEFORE the order update so we
  // can roll it into the same write. If ANY line is digital we ALSO
  // flip the order straight to DELIVERED — there's nothing to ship,
  // it's been delivered the moment the slip cleared (911korn 2026-05-27
  // "พอเห็นภาพมั้ย ตอนนี้ Work Flow มันเหมือนกับส่งไปรษณีย์เลย ซึ่งมันผิด").
  const fulfillment = await buildDigitalFulfillment(order);
  const isDigitalOrder = fulfillment.allLinesDigital;
  const now = new Date();

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      status: isDigitalOrder ? OrderStatus.DELIVERED : OrderStatus.PAID,
      slipImageUrl: uploadedSlipUrl ?? order.slipImageUrl,
      slipRef: result.ref,
      slipVerifiedAt: now,
      slipProvider: result.provider,
      slipRaw: result.raw
        ? JSON.parse(JSON.stringify(result.raw))
        : undefined,
      ...(fulfillment.content
        ? { digitalFulfillment: fulfillment.content, digitalFulfilledAt: now }
        : {}),
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
  void sendOrderPaid({
    ...emailCtx,
    digitalFulfillment: fulfillment.content,
  });
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

/**
 * Snapshot digital-fulfillment content from every line item in `order.items`.
 *
 * For each productSlug in the snapshot, look up `Product.digitalContent`.
 * If the product is DIGITAL and has content set, we join all of them into
 * one block separated by clear headers per line item (the seller might
 * have grouped multiple skus into the same digital product, or sold
 * multiples — we keep the read flat).
 *
 * Returns whether every line was digital so the caller knows whether to
 * auto-flip the order to DELIVERED.
 */
interface SnapshotInput {
  shopId: string;
  items: unknown;
}
async function buildDigitalFulfillment(
  order: SnapshotInput,
): Promise<{ content: string | null; allLinesDigital: boolean }> {
  const itemsRaw = Array.isArray(order.items) ? order.items : [];
  if (itemsRaw.length === 0) return { content: null, allLinesDigital: false };

  const slugs = itemsRaw
    .map((i) => (i as { productSlug?: string })?.productSlug)
    .filter((s): s is string => Boolean(s));
  if (slugs.length === 0) return { content: null, allLinesDigital: false };

  const products = await db.product.findMany({
    where: { shopId: order.shopId, slug: { in: slugs } },
    select: { slug: true, type: true, digitalContent: true, name: true },
  });
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const blocks: string[] = [];
  let allDigital = true;
  for (const raw of itemsRaw) {
    const slug = (raw as { productSlug?: string })?.productSlug;
    const qty = (raw as { qty?: number })?.qty ?? 1;
    if (!slug) {
      allDigital = false;
      continue;
    }
    const p = bySlug.get(slug);
    if (!p) {
      allDigital = false;
      continue;
    }
    if (p.type !== "DIGITAL") {
      allDigital = false;
      continue;
    }
    if (p.digitalContent) {
      blocks.push(
        `▼ ${p.name}${qty > 1 ? ` × ${qty}` : ""}\n${p.digitalContent}`,
      );
    }
  }
  return {
    content: blocks.length ? blocks.join("\n\n────────\n\n") : null,
    allLinesDigital: allDigital && blocks.length > 0,
  };
}
