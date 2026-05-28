import { ok, fail } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { hasBusinessPlan } from "@/lib/plan";
import { decryptSecret } from "@/lib/payment-gateways/crypto";
import { testConnection } from "@/lib/payment-gateways/adapters";

export const runtime = "nodejs";

/**
 * POST /api/v1/shops/[slug]/payment-gateways/[id]/test
 *
 * Re-runs the provider's testConnection against the stored keys —
 * useful when a seller has updated their keys at the provider (e.g.
 * rotated the Omise secret) and wants to confirm the new ones still
 * work without re-entering them in our UI.
 */
interface Ctx {
  params: Promise<{ slug: string; id: string }>;
}

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
      "Payment gateways ใช้ได้กับแผน Business ขึ้นไป",
      402,
    );
  }

  const row = await db.shopPaymentGateway.findUnique({ where: { id } });
  if (!row || row.shopId !== shop.id) {
    return fail("not_found", "ไม่พบ gateway นี้", 404);
  }

  let secret: string;
  try {
    secret = decryptSecret(row.secretKeyEncrypted);
  } catch {
    return fail(
      "decrypt_failed",
      "Decrypt secret key ไม่สำเร็จ — keys อาจถูกบันทึกในรอบที่ใช้ env key อื่น ลองลบแล้วใส่ใหม่",
      500,
    );
  }

  const result = await testConnection(row.provider, {
    publicKey: row.publicKey,
    secretKey: secret,
    mode: row.mode,
  });

  const updated = await db.shopPaymentGateway.update({
    where: { id: row.id },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: result.ok ? "OK" : "FAILED",
      lastTestMessage: result.ok
        ? result.accountLabel ?? null
        : result.errorMessage ?? null,
    },
  });

  return ok({
    test: result,
    lastTestedAt: updated.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: updated.lastTestStatus,
    lastTestMessage: updated.lastTestMessage,
  });
}
