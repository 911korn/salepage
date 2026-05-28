import { ok, fail } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, ShopDomainStatus } from "@/lib/db";
import { hasBusinessPlan } from "@/lib/plan";
import { verifyZone } from "@/lib/cloudflare-zones";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ slug: string; id: string }>;
}

/** POST /api/v1/shops/[slug]/domains/[id]/verify
 *  Seller clicks "เช็คเลย" after pasting NS at registrar. We hit
 *  CF's `activation_check` to force re-check, then read back the
 *  zone status and update the row. */
export async function POST(request: Request, ctx: Ctx) {
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
  if (!row.cfZoneId) {
    return fail("missing_zone", "ยังไม่ได้สร้าง zone — กรุณาลบและเพิ่มใหม่", 500);
  }

  let zone;
  try {
    zone = await verifyZone(row.cfZoneId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloudflare API";
    await db.shopDomain.update({
      where: { id: row.id },
      data: {
        lastCheckedAt: new Date(),
        status: ShopDomainStatus.FAILED,
        failedReason: message.slice(0, 500),
      },
    });
    return fail("cloudflare_error", message, 502);
  }

  const nextStatus =
    zone.status === "active"
      ? ShopDomainStatus.VERIFIED
      : zone.status === "pending" || zone.status === "initializing"
        ? ShopDomainStatus.PENDING_DNS
        : ShopDomainStatus.FAILED;

  const updated = await db.shopDomain.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      verifiedAt:
        nextStatus === ShopDomainStatus.VERIFIED
          ? row.verifiedAt ?? new Date()
          : null,
      lastCheckedAt: new Date(),
      failedReason:
        nextStatus === ShopDomainStatus.FAILED
          ? `Zone status: ${zone.status}`
          : null,
      ns1: zone.nameservers[0] ?? row.ns1,
      ns2: zone.nameservers[1] ?? row.ns2,
    },
  });

  return ok({
    status: updated.status,
    cfZoneStatus: zone.status,
    verifiedAt: updated.verifiedAt?.toISOString() ?? null,
  });
}
