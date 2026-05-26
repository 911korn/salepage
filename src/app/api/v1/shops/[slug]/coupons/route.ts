import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, CouponType } from "@/lib/db";

const PostBody = z
  .object({
    code: z
      .string()
      .min(2)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Code must be alphanumeric / - / _"),
    type: z.enum(["PERCENT", "FIXED"]),
    percent: z.number().int().min(1).max(100).optional().nullable(),
    amountSatang: z.number().int().min(100).max(10_000_000).optional().nullable(),
    minOrderSatang: z.number().int().min(0).optional().nullable(),
    maxRedemptions: z.number().int().min(1).optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
    active: z.boolean().optional(),
  })
  .refine(
    (b) =>
      (b.type === "PERCENT" && b.percent != null) ||
      (b.type === "FIXED" && b.amountSatang != null),
    {
      message: "PERCENT requires percent; FIXED requires amountSatang",
    },
  );

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const coupons = await db.coupon.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });
  return ok({ coupons });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await context.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const parsed = await parseJson(request, PostBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const code = input.code.toLowerCase();
  const existing = await db.coupon.findUnique({
    where: { shopId_code: { shopId: shop.id, code } },
    select: { id: true },
  });
  if (existing) return fail("duplicate", "รหัสคูปองซ้ำกับที่มีอยู่แล้ว", 409);

  const coupon = await db.coupon.create({
    data: {
      shopId: shop.id,
      code,
      type: input.type as CouponType,
      percent: input.type === "PERCENT" ? (input.percent ?? null) : null,
      amountSatang: input.type === "FIXED" ? (input.amountSatang ?? null) : null,
      minOrderSatang: input.minOrderSatang ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      active: input.active ?? true,
    },
  });
  return ok({ coupon }, { status: 201 });
}
