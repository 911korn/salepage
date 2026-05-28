import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { hasBusinessPlan } from "@/lib/plan";

export const runtime = "nodejs";

/** PATCH — toggle enabled / change label. Keys are NOT mutable here;
 *  to swap keys, POST a new row on the parent endpoint (it upserts).
 *
 *  DELETE — remove the row entirely. */

const PatchSchema = z.object({
  enabled: z.boolean().optional(),
  label: z.string().max(80).nullable().optional(),
});

interface Ctx {
  params: Promise<{ slug: string; id: string }>;
}

async function guard(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return { err: session.response } as const;
  const { slug, id } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return { err: fail("not_found", "ไม่พบร้าน", 404) } as const;
  if (shop.ownerId !== session.user.id) {
    return { err: fail("forbidden", "ไม่ใช่เจ้าของร้านนี้", 403) } as const;
  }
  if (!(await hasBusinessPlan(session.user.id))) {
    return {
      err: fail(
        "upgrade_required",
        "Payment gateways ใช้ได้กับแผน Business ขึ้นไป",
        402,
      ),
    } as const;
  }
  const row = await db.shopPaymentGateway.findUnique({ where: { id } });
  if (!row || row.shopId !== shop.id) {
    return { err: fail("not_found", "ไม่พบ gateway นี้", 404) } as const;
  }
  return { row } as const;
}

export async function PATCH(request: Request, ctx: Ctx) {
  const g = await guard(request, ctx);
  if ("err" in g) return g.err;
  const parsed = await parseJson(request, PatchSchema);
  if (!parsed.ok) return parsed.response;

  const updated = await db.shopPaymentGateway.update({
    where: { id: g.row.id },
    data: {
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
    },
  });
  return ok({ id: updated.id, enabled: updated.enabled, label: updated.label });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const g = await guard(request, ctx);
  if ("err" in g) return g.err;
  await db.shopPaymentGateway.delete({ where: { id: g.row.id } });
  return ok({ deleted: true });
}
