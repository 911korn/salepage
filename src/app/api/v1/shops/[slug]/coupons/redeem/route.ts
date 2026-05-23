import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";

const Body = z.object({
  code: z.string().min(1).max(40),
  subtotalSatang: z.number().int().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { code, subtotalSatang } = parsed.data;

  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);

  const coupon = await db.coupon.findUnique({
    where: { shopId_code: { shopId: shop.id, code: code.toLowerCase() } },
  });
  if (!coupon || !coupon.active)
    return fail("invalid_code", "รหัสคูปองไม่ถูกต้อง", 404);
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now())
    return fail("expired", "คูปองหมดอายุแล้ว", 400);
  if (
    coupon.maxRedemptions !== null &&
    coupon.redeemedCount >= coupon.maxRedemptions
  )
    return fail("exhausted", "คูปองถูกใช้ครบจำนวนแล้ว", 400);
  if (
    coupon.minOrderSatang !== null &&
    subtotalSatang < coupon.minOrderSatang
  )
    return fail(
      "below_minimum",
      `ยอดสั่งซื้อขั้นต่ำ ฿${Math.round(coupon.minOrderSatang / 100).toLocaleString()}`,
      400,
    );

  let discountSatang = 0;
  if (coupon.type === "PERCENT" && coupon.percent !== null) {
    discountSatang = Math.floor((subtotalSatang * coupon.percent) / 100);
  } else if (coupon.type === "FIXED" && coupon.amountSatang !== null) {
    discountSatang = Math.min(coupon.amountSatang, subtotalSatang);
  }

  return ok({
    couponId: coupon.id,
    code: coupon.code,
    type: coupon.type,
    discountSatang,
  });
}
