import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const PatchBody = z.object({
  active: z.boolean().optional(),
  maxRedemptions: z.number().int().min(1).optional().nullable(),
  minOrderSatang: z.number().int().min(0).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Sign in required", 401);

  const { slug, id } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const coupon = await db.coupon.findUnique({
    where: { id },
    select: { shopId: true },
  });
  if (!coupon || coupon.shopId !== shop.id)
    return fail("not_found", "ไม่พบคูปอง", 404);

  const parsed = await parseJson(request, PatchBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const updated = await db.coupon.update({
    where: { id },
    data: {
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.maxRedemptions !== undefined
        ? { maxRedemptions: input.maxRedemptions }
        : {}),
      ...(input.minOrderSatang !== undefined
        ? { minOrderSatang: input.minOrderSatang }
        : {}),
      ...(input.expiresAt !== undefined
        ? {
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          }
        : {}),
    },
  });
  return ok({ coupon: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return fail("unauthorized", "Sign in required", 401);

  const { slug, id } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const coupon = await db.coupon.findUnique({
    where: { id },
    select: { shopId: true },
  });
  if (!coupon || coupon.shopId !== shop.id)
    return fail("not_found", "ไม่พบคูปอง", 404);

  await db.coupon.delete({ where: { id } });
  return ok({ deleted: true });
}
