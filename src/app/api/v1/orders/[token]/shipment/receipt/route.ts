import { z } from "zod";
import { put } from "@vercel/blob";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, OrderStatus } from "@/lib/db";
import { buildOrderRef } from "@/lib/orders";
import { sendOrderShipped } from "@/lib/email";
import { notifyLineOrderUpdate } from "@/lib/line-order-notifications";
import { hasBusinessPlan } from "@/lib/plan";
import {
  scanShippingReceipt,
  namesLooselyMatch,
  type ScannedReceipt,
} from "@/lib/ocr-shipping-receipt";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/v1/orders/[token]/shipment/receipt
 *
 * Seller drops a parcel at any courier (Flash/Kerry/J&T/Thai Post),
 * pays cash, snaps a photo of the printed receipt. Claude vision OCR
 * extracts {trackingNumber, receiverName, courier} → we verify the name
 * matches this order → auto-fill `trackingNumber`, flip PAID→SHIPPING,
 * email buyer, LINE push.
 *
 * Free for every seller, no Pro subscription gate — this is the
 * default shipping flow that replaces EasyParcel.
 *
 * Body:
 *   - dataBase64: base64-encoded receipt photo
 *   - contentType: image/jpeg | image/png | image/webp
 *   - confirmOverride?: true — bypass the name-match warning if seller
 *     insists the OCR was right despite a name mismatch (rare; happens
 *     when the courier counter staff misread the printed label).
 */
const Body = z.object({
  dataBase64: z.string().min(100).max(10_000_000),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  confirmOverride: z.boolean().optional().default(false),
});

interface Ctx {
  params: Promise<{ token: string }>;
}

export async function POST(request: Request, ctx: Ctx) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail(
      "ocr_not_configured",
      "AI scan ยังไม่พร้อมใช้งาน — ใส่เลข tracking มือไปก่อน",
      503,
    );
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return fail(
      "blob_not_configured",
      "Image upload not configured on this deployment",
      503,
    );
  }

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
  // V2.1 Auto Tracking gate — Business+ only. 911korn 2026-05-28.
  if (!(await hasBusinessPlan(session.user.id))) {
    return fail(
      "upgrade_required",
      "AI Auto Tracking ใช้ได้กับแผน Business ขึ้นไป",
      402,
    );
  }
  if (
    order.status !== OrderStatus.PAID &&
    order.status !== OrderStatus.SHIPPING
  ) {
    return fail(
      "wrong_status",
      "อัปโหลดใบเสร็จได้เฉพาะออเดอร์ที่ลูกค้าชำระเงินแล้ว",
      409,
    );
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Cheap base64 → bytes check before paying for an OCR call.
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(input.dataBase64, "base64"));
  } catch {
    return fail("bad_base64", "รูปอ่านไม่ออก ลองอัปโหลดใหม่", 400);
  }
  if (bytes.byteLength < 1024) {
    return fail("too_small", "รูปเล็กเกินไป ลองถ่ายใหม่ให้เห็นเลขชัด", 400);
  }
  if (bytes.byteLength > 5 * 1024 * 1024) {
    return fail("too_large", "รูปใหญ่เกินไป (เกิน 5 MB)", 413);
  }

  // Upload to Vercel Blob first — even if OCR fails, we keep the photo
  // so seller can retry + ops can audit later.
  const ext =
    input.contentType === "image/png"
      ? "png"
      : input.contentType === "image/webp"
        ? "webp"
        : "jpg";
  const pathname = `u/${session.user.id}/shipping-receipts/${order.publicToken}-${Date.now()}.${ext}`;
  const blob = await put(pathname, Buffer.from(bytes), {
    access: "public",
    contentType: input.contentType,
    addRandomSuffix: false,
  });

  let scan: ScannedReceipt;
  try {
    scan = await scanShippingReceipt(input.dataBase64, input.contentType);
  } catch (err) {
    console.error("Claude vision OCR failed:", err);
    // Persist the receipt URL even on OCR failure so the seller can
    // retry the scan against the same image later.
    await db.order.update({
      where: { id: order.id },
      data: { shippingReceiptUrl: blob.url },
    });
    return fail(
      "ocr_failed",
      "AI scan ไม่สำเร็จ ลองอีกครั้งหรือกรอกเลขมือ",
      502,
    );
  }

  if (!scan.trackingNumber) {
    await db.order.update({
      where: { id: order.id },
      data: { shippingReceiptUrl: blob.url },
    });
    return ok({
      ok: false,
      scan,
      receiptUrl: blob.url,
      reason: "no_tracking",
      message:
        scan.note ??
        "ไม่เจอเลข tracking บนรูปนี้ ลองถ่ายให้เห็นชัดกว่าเดิม หรือกรอกมือ",
    });
  }

  // Name-match guard. Three cases — each gates the auto-fulfill differently
  // so we never silently SHIP an order without some kind of seller signal.
  //
  //  (a) OCR extracted a name + it matches the order → proceed silently.
  //      Best case.
  //
  //  (b) OCR extracted a name + it does NOT match → "name_mismatch" warning,
  //      seller must hit confirmOverride to proceed.
  //
  //  (c) OCR returned receiverName=null (very common — Thailand Post,
  //      J&T economy, eCo-Post etc. don't print the recipient name on
  //      the drop-off receipt). Previously the route silently skipped
  //      to auto-fulfill — which means a seller could attach the wrong
  //      parcel's receipt to the wrong order and we'd never catch it.
  //      Now we return "name_unreadable" — the dashboard shows the
  //      buyer's name + address from the order and asks the seller to
  //      double-check before pressing "confirm". 911korn 2026-05-28
  //      "ชื่อใน ใบเสร็จขนส่งมันไม่ตรง แต่มัน ผ่านไปเลยแบบเหมือนตรง
  //      ไม่ขึ้นแจ้งเตือนว่าไม่ตรง".
  let nameMatched: boolean | null = null;
  if (scan.receiverName) {
    nameMatched = namesLooselyMatch(scan.receiverName, order.customerName);
  }
  if (!input.confirmOverride) {
    if (scan.receiverName && nameMatched === false) {
      await db.order.update({
        where: { id: order.id },
        data: { shippingReceiptUrl: blob.url },
      });
      return ok({
        ok: false,
        scan,
        receiptUrl: blob.url,
        reason: "name_mismatch",
        message: `AI อ่านชื่อผู้รับเป็น "${scan.receiverName}" แต่ออเดอร์นี้ของ "${order.customerName}" — ยืนยันถ้าใช่จริง`,
      });
    }
    if (!scan.receiverName) {
      await db.order.update({
        where: { id: order.id },
        data: { shippingReceiptUrl: blob.url },
      });
      return ok({
        ok: false,
        scan,
        receiptUrl: blob.url,
        reason: "name_unreadable",
        message: `ใบเสร็จไม่มีชื่อผู้รับให้ AI ตรวจสอบ (พบบ่อยใน ไปรษณีย์ไทย / J&T eCo) — กรุณายืนยันว่าพัสดุนี้ส่งให้ "${order.customerName}" ที่ ${order.customerAddress ?? "(ไม่มีที่อยู่)"} จริงก่อนกดยืนยัน`,
      });
    }
  }

  // Happy path — apply tracking + flip status.
  const now = new Date();
  const trackingNumber = scan.trackingNumber;
  await db.$transaction([
    db.order.update({
      where: { id: order.id },
      data: {
        trackingNumber,
        shippingReceiptUrl: blob.url,
        shippingReceiptScannedAt: now,
        ...(order.status === OrderStatus.PAID
          ? { status: OrderStatus.SHIPPING }
          : {}),
      },
    }),
    db.shipment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        shopId: order.shop.id,
        provider: "self-dropoff",
        courierCode: scan.courier ?? "OTHER",
        courierName: scan.courier ?? "อื่นๆ",
        handoff: "DROPOFF",
        status: "IN_TRANSIT",
        trackingNumber,
        receiverName: order.customerName,
        receiverPhone: order.customerPhone,
        receiverAddress: order.customerAddress,
        labelUrl: blob.url,
        bookedAt: now,
        shippedAt: now,
      },
      update: {
        provider: "self-dropoff",
        courierCode: scan.courier ?? "OTHER",
        courierName: scan.courier ?? "อื่นๆ",
        trackingNumber,
        labelUrl: blob.url,
        status: "IN_TRANSIT",
        shippedAt: now,
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
    trackingNumber,
  });
  void notifyLineOrderUpdate({
    ...order,
    status: OrderStatus.SHIPPING,
    trackingNumber,
  });

  return ok({
    ok: true,
    trackingNumber,
    courier: scan.courier,
    receiverName: scan.receiverName,
    nameMatched,
    receiptUrl: blob.url,
    confidence: scan.confidence,
  });
}
