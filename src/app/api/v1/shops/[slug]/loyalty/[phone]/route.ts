import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";

function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; phone: string }> },
) {
  const { slug, phone } = await context.params;
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length < 9) return fail("invalid_phone", "เบอร์ไม่ถูกต้อง", 400);

  const shop = await db.shop.findUnique({
    where: { slug },
    select: {
      id: true,
      loyaltyBahtPerPoint: true,
      loyaltyBahtValuePerPoint: true,
    },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);

  const wallet = await db.customerLoyalty.findUnique({
    where: {
      shopId_customerPhone: { shopId: shop.id, customerPhone: cleanPhone },
    },
  });

  return ok({
    points: wallet?.points ?? 0,
    totalSpentSatang: wallet?.totalSpentSatang ?? 0,
    config: {
      bahtPerPoint: shop.loyaltyBahtPerPoint,
      bahtValuePerPoint: shop.loyaltyBahtValuePerPoint,
    },
  });
}
