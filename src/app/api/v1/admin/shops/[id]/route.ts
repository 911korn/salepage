import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { logAdminAction, requireAdminApi } from "@/lib/admin";
import { db, ShopStatus } from "@/lib/db";

const Body = z
  .object({
    suspended: z.boolean().optional(),
    featured: z.boolean().optional(),
    verified: z.boolean().optional(),
    status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
    slipCreditsDelta: z.number().int().optional(),
    lineWebhookEnabled: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: "ต้องส่งฟิลด์อย่างน้อย 1 ฟิลด์",
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

  const shop = await db.shop.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      suspended: true,
      featured: true,
      verified: true,
      status: true,
      slipCredits: true,
      lineWebhookEnabled: true,
    },
  });
  if (!shop) return fail("not_found", "Shop not found", 404);

  const data: Record<string, unknown> = {};
  if (body.suspended !== undefined) data.suspended = body.suspended;
  if (body.featured !== undefined) data.featured = body.featured;
  if (body.verified !== undefined) data.verified = body.verified;
  if (body.status !== undefined) data.status = body.status as ShopStatus;
  if (body.lineWebhookEnabled !== undefined) data.lineWebhookEnabled = body.lineWebhookEnabled;

  if (body.slipCreditsDelta !== undefined) {
    const next = shop.slipCredits + body.slipCreditsDelta;
    if (next < 0) {
      return fail("invalid_credit_balance", "หักเครดิตเกินยอดปัจจุบัน", 422);
    }
    data.slipCredits = next;
  }

  const updated = await db.shop.update({
    where: { id },
    data,
    select: {
      id: true,
      slug: true,
      suspended: true,
      featured: true,
      verified: true,
      status: true,
      slipCredits: true,
      lineWebhookEnabled: true,
    },
  });

  await logAdminAction(
    ctx.userId,
    "shop.update",
    { type: "shop", id },
    {
      before: shop,
      after: updated,
      changes: Object.keys(body),
      ...(body.slipCreditsDelta !== undefined
        ? { creditDelta: body.slipCreditsDelta }
        : {}),
    },
  );

  return ok({ shop: updated });
}
