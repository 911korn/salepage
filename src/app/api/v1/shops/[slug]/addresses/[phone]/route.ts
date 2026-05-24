import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeCustomerPhone } from "@/lib/customer-addresses";

interface Ctx {
  params: Promise<{ slug: string; phone: string }>;
}

export async function GET(_request: Request, ctx: Ctx) {
  const { slug, phone } = await ctx.params;
  const customerPhone = normalizeCustomerPhone(phone);
  if (customerPhone.length < 9) {
    return fail("phone_required", "กรุณาใส่เบอร์โทรให้ครบ", 422);
  }

  const shop = await db.shop.findFirst({
    where: { slug, status: "ACTIVE", suspended: false },
    select: { id: true },
  });
  if (!shop) return fail("shop_not_found", "ไม่พบร้านค้านี้", 404);

  const addresses = await db.customerAddress.findMany({
    where: { shopId: shop.id, customerPhone },
    orderBy: [{ lastUsedAt: "desc" }, { useCount: "desc" }],
    take: 3,
    select: {
      id: true,
      label: true,
      customerName: true,
      address: true,
      postcode: true,
      useCount: true,
      lastUsedAt: true,
    },
  });

  return ok({
    addresses: addresses.map((address) => ({
      ...address,
      lastUsedAt: address.lastUsedAt.toISOString(),
    })),
  });
}
