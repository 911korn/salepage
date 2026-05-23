import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { logAdminAction, requireAdminApi } from "@/lib/admin";
import { db } from "@/lib/db";

const Body = z.object({ active: z.boolean() });

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const { id } = await params;

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  const coupon = await db.coupon.findUnique({
    where: { id },
    select: { id: true, shopId: true, code: true, active: true },
  });
  if (!coupon) return fail("not_found", "Coupon not found", 404);

  const updated = await db.coupon.update({
    where: { id },
    data: { active: parsed.data.active },
    select: { id: true, code: true, active: true },
  });

  await logAdminAction(
    ctx.userId,
    "coupon.active_toggle",
    { type: "coupon", id },
    { shopId: coupon.shopId, code: coupon.code, before: coupon.active, after: updated.active },
  );

  return ok({ coupon: updated });
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const { id } = await params;

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  const coupon = await db.coupon.findUnique({
    where: { id },
    select: { id: true, shopId: true, code: true },
  });
  if (!coupon) return fail("not_found", "Coupon not found", 404);

  await db.coupon.delete({ where: { id } });

  await logAdminAction(
    ctx.userId,
    "coupon.delete",
    { type: "coupon", id },
    { shopId: coupon.shopId, code: coupon.code },
  );

  return ok({ deleted: true });
}
