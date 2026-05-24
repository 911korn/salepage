import { z } from "zod";
import { verifySlip } from "@/lib/slip-verify";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { tryConsumeSlip } from "@/lib/slip-credits";
import { extractSlipQrPayloadFromBase64 } from "@/lib/slip-qr";

const Body = z
  .object({
    imageBase64: z.string().optional(),
    qrPayload: z.string().optional(),
    expectAmount: z.number().positive().optional(),
    expectReceiverId: z.string().optional(),
    /// If supplied, meter the call against this shop's plan quota + credit
    /// wallet. Omit for dev/test calls — those skip metering entirely
    /// (and SlipOK quota is still charged regardless).
    shopSlug: z.string().optional(),
  })
  .refine((v) => Boolean(v.imageBase64 || v.qrPayload), {
    message: "ต้องส่ง imageBase64 หรือ qrPayload",
  });

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  let consumeSource: "quota" | "credit" | null = null;
  if (input.shopSlug) {
    const shop = await db.shop.findUnique({
      where: { slug: input.shopSlug },
      select: { id: true, ownerId: true, suspended: true },
    });
    if (!shop || shop.suspended) {
      return fail("shop_not_found", "ไม่พบร้านนี้", 404);
    }
    const consume = await tryConsumeSlip(shop.id, shop.ownerId);
    if (!consume.ok) {
      return fail(
        "slip_quota_exhausted",
        "ร้านนี้ใช้โควต้าเช็คสลิปเดือนนี้หมดแล้ว เจ้าของร้านต้องเติมเครดิตก่อน",
        402,
        { remaining: consume.remaining },
      );
    }
    consumeSource = consume.source;
  }

  try {
    const result = await verifySlip({
      ...input,
      qrPayload: input.qrPayload ??
        (await extractSlipQrPayloadFromBase64(input.imageBase64)) ??
        undefined,
    });
    return ok({ ...result, ...(consumeSource ? { consumedFrom: consumeSource } : {}) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return fail("slip_verify_error", message, 400);
  }
}
