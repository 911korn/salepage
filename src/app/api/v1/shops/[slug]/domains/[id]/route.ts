import { ok, fail } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { hasBusinessPlan } from "@/lib/plan";
import { deleteZone } from "@/lib/cloudflare-zones";
import { detachDomainFromProject } from "@/lib/vercel-project-domains";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ slug: string; id: string }>;
}

/** DELETE — remove the CF zone + detach from Vercel + drop the row. */
export async function DELETE(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { slug, id } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้าน", 404);
  if (shop.ownerId !== session.user.id) {
    return fail("forbidden", "ไม่ใช่เจ้าของร้านนี้", 403);
  }
  if (!(await hasBusinessPlan(session.user.id))) {
    return fail(
      "upgrade_required",
      "Custom domain ใช้ได้กับแผน Business ขึ้นไป",
      402,
    );
  }
  const row = await db.shopDomain.findUnique({ where: { id } });
  if (!row || row.shopId !== shop.id) {
    return fail("not_found", "ไม่พบโดเมนนี้", 404);
  }

  // Best-effort cleanup on the external services — never block the DB
  // delete on these.
  if (row.cfZoneId) {
    try {
      await deleteZone(row.cfZoneId);
    } catch (err) {
      console.warn("[shop-domain] CF zone delete failed:", err);
    }
  }
  try {
    await detachDomainFromProject(row.domain);
  } catch (err) {
    console.warn("[shop-domain] Vercel detach failed:", err);
  }
  await db.shopDomain.delete({ where: { id: row.id } });
  return ok({ deleted: true });
}
