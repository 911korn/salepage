import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, ShopDomainStatus } from "@/lib/db";
import { hasBusinessPlan } from "@/lib/plan";
import {
  createZone,
  findZoneByName,
  attachVercelRecords,
} from "@/lib/cloudflare-zones";
import { attachDomainToProject } from "@/lib/vercel-project-domains";

export const runtime = "nodejs";

/**
 * GET  /api/v1/shops/[slug]/domains          — list seller's domains
 * POST /api/v1/shops/[slug]/domains { domain } — onboard new domain
 *
 * Onboarding sequence:
 *  1. Create a CF zone (idempotent — re-use if it already exists)
 *  2. Add A + CNAME DNS records pointing to Vercel
 *  3. Attach the hostname to our Vercel project so 76.76.21.21 routes to us
 *  4. Persist the row with ns1+ns2 — seller pastes those at registrar
 *
 * Business+ gated.
 */

const BodySchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(253)
    .regex(
      /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/,
      "ใส่ชื่อโดเมนเต็มๆ เช่น mystore.com (ไม่ต้องใส่ https:// หรือ /)",
    ),
});

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { slug } = await ctx.params;
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
  const rows = await db.shopDomain.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "asc" },
  });
  return ok({
    domains: rows.map((r) => ({
      id: r.id,
      domain: r.domain,
      ns1: r.ns1,
      ns2: r.ns2,
      status: r.status,
      failedReason: r.failedReason,
      verifiedAt: r.verifiedAt?.toISOString() ?? null,
      lastCheckedAt: r.lastCheckedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { slug } = await ctx.params;
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

  const parsed = await parseJson(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const domain = parsed.data.domain.replace(/\/$/, "");

  if (
    domain.endsWith(".vercel.app") ||
    domain.endsWith(".salepage.in.th") ||
    domain === "salepage.in.th"
  ) {
    return fail(
      "reserved_domain",
      "โดเมน vercel.app และ salepage.in.th สงวนไว้สำหรับแพลตฟอร์ม",
      400,
    );
  }

  const existing = await db.shopDomain.findUnique({ where: { domain } });
  if (existing && existing.shopId !== shop.id) {
    return fail(
      "domain_taken",
      "โดเมนนี้ถูกใช้กับร้านอื่นในระบบแล้ว — ติดต่อทีมเราถ้าคิดว่าผิดพลาด",
      409,
    );
  }

  // ── 1. CF zone — idempotent (re-use if exists) ──
  let cfZone;
  try {
    const found = await findZoneByName(domain);
    cfZone = found ?? (await createZone(domain));
  } catch (err) {
    return fail(
      "cloudflare_error",
      err instanceof Error ? err.message : "Cloudflare API error",
      502,
    );
  }

  // ── 2. CF DNS records → Vercel ──
  try {
    await attachVercelRecords(cfZone.id, domain);
  } catch (err) {
    return fail(
      "cloudflare_error",
      err instanceof Error
        ? `Set DNS records ล้มเหลว: ${err.message}`
        : "DNS records error",
      502,
    );
  }

  // ── 3. Vercel project attachment — best-effort ──
  // We persist the row even if Vercel attach fails, because the seller
  // can still get a working setup once we manually attach later via the
  // admin queue. Common failures here are "domain already on another
  // Vercel team" — admin needs to reach out to release.
  let vercelError: string | null = null;
  try {
    await attachDomainToProject(domain);
  } catch (err) {
    vercelError =
      err instanceof Error ? err.message : "Vercel attach failed";
    console.warn("[shop-domain] Vercel attach failed for", domain, vercelError);
  }

  // ── 4. Persist ──
  const row = await db.shopDomain.upsert({
    where: { domain },
    create: {
      shopId: shop.id,
      domain,
      cfZoneId: cfZone.id,
      ns1: cfZone.nameservers[0] ?? null,
      ns2: cfZone.nameservers[1] ?? null,
      status:
        cfZone.status === "active"
          ? ShopDomainStatus.VERIFIED
          : ShopDomainStatus.PENDING_DNS,
      verifiedAt: cfZone.status === "active" ? new Date() : null,
      lastCheckedAt: new Date(),
      failedReason: vercelError,
    },
    update: {
      cfZoneId: cfZone.id,
      ns1: cfZone.nameservers[0] ?? null,
      ns2: cfZone.nameservers[1] ?? null,
      status:
        cfZone.status === "active"
          ? ShopDomainStatus.VERIFIED
          : ShopDomainStatus.PENDING_DNS,
      verifiedAt: cfZone.status === "active" ? new Date() : null,
      lastCheckedAt: new Date(),
      failedReason: vercelError,
    },
  });

  return ok({
    id: row.id,
    domain: row.domain,
    ns1: row.ns1,
    ns2: row.ns2,
    status: row.status,
    failedReason: row.failedReason,
  });
}
