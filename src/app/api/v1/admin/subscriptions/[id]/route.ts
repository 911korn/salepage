import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { logAdminAction, requireAdminApi } from "@/lib/admin";
import { db } from "@/lib/db";

const Body = z
  .object({
    extendDays: z.number().int().min(1).max(3650).optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
  })
  .refine((b) => b.extendDays !== undefined || b.cancelAtPeriodEnd !== undefined, {
    message: "ต้องส่ง extendDays หรือ cancelAtPeriodEnd อย่างน้อย 1",
  });

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
  const body = parsed.data;

  const sub = await db.subscription.findUnique({
    where: { id },
    select: {
      id: true,
      stripeSubscriptionId: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });
  if (!sub) return fail("not_found", "Subscription not found", 404);

  const data: Record<string, unknown> = {};

  if (body.extendDays !== undefined) {
    // Extend from the later of: now, current period end. Same logic as
    // PromptPay top-up in billing/webhook so an admin extend feels identical.
    const base =
      sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > Date.now()
        ? sub.currentPeriodEnd
        : new Date();
    const extended = new Date(base);
    extended.setDate(extended.getDate() + body.extendDays);
    data.currentPeriodEnd = extended;
  }

  if (body.cancelAtPeriodEnd !== undefined) {
    data.cancelAtPeriodEnd = body.cancelAtPeriodEnd;
  }

  const updated = await db.subscription.update({
    where: { id },
    data,
    select: {
      id: true,
      plan: true,
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  await logAdminAction(
    ctx.userId,
    body.extendDays !== undefined ? "subscription.extend" : "subscription.cancel_toggle",
    { type: "subscription", id },
    {
      before: { currentPeriodEnd: sub.currentPeriodEnd, cancelAtPeriodEnd: sub.cancelAtPeriodEnd },
      after: { currentPeriodEnd: updated.currentPeriodEnd, cancelAtPeriodEnd: updated.cancelAtPeriodEnd },
      ...(body.extendDays !== undefined ? { extendDays: body.extendDays } : {}),
    },
  );

  return ok({ subscription: updated });
}
