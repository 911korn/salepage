import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, PaymentGatewayProvider, PaymentGatewayMode } from "@/lib/db";
import { hasProPlan } from "@/lib/plan";
import { encryptSecret, maskKey, decryptSecret } from "@/lib/payment-gateways/crypto";
import { getProvider } from "@/lib/payment-gateways/registry";
import { testConnection } from "@/lib/payment-gateways/adapters";

export const runtime = "nodejs";

/**
 * GET  /api/v1/shops/[slug]/payment-gateways
 *   → List the shop's configured gateways. Secrets are NEVER returned —
 *     only a masked preview ("skey_test_••••5GqLP").
 *
 * POST /api/v1/shops/[slug]/payment-gateways
 *   → Add a new gateway. Body { provider, mode, publicKey, secretKey,
 *     webhookSecret?, label? }. Server runs testConnection() against the
 *     provider's API before saving so the seller knows immediately if
 *     the keys are wrong; on success the row is saved with `enabled:
 *     true` + `lastTestStatus: OK`.
 *
 * Pro+ gated for both verbs.
 */

const BodySchema = z.object({
  provider: z.nativeEnum(PaymentGatewayProvider),
  mode: z.nativeEnum(PaymentGatewayMode),
  publicKey: z.string().min(2).max(500),
  secretKey: z.string().min(2).max(1000),
  webhookSecret: z.string().max(1000).optional().nullable(),
  label: z.string().max(80).optional().nullable(),
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
  if (!(await hasProPlan(session.user.id))) {
    return fail(
      "upgrade_required",
      "Payment gateways ใช้ได้กับแผน Pro ขึ้นไป",
      402,
    );
  }

  const rows = await db.shopPaymentGateway.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "asc" },
  });

  return ok({
    gateways: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      mode: r.mode,
      publicKey: r.publicKey,
      publicKeyMasked: maskKey(r.publicKey),
      secretKeyMasked: maskKey(safeDecrypt(r.secretKeyEncrypted)),
      hasWebhookSecret: Boolean(r.webhookSecretEncrypted),
      label: r.label,
      enabled: r.enabled,
      lastTestedAt: r.lastTestedAt?.toISOString() ?? null,
      lastTestStatus: r.lastTestStatus,
      lastTestMessage: r.lastTestMessage,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
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
  if (!(await hasProPlan(session.user.id))) {
    return fail(
      "upgrade_required",
      "Payment gateways ใช้ได้กับแผน Pro ขึ้นไป",
      402,
    );
  }

  const parsed = await parseJson(request, BodySchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Server-side gate against roadmap providers — UI hides them but
  // we re-check to ensure no one bypasses by hitting the API directly.
  const meta = getProvider(input.provider);
  if (meta.availability !== "live") {
    return fail(
      "not_available_yet",
      `${meta.name} ยังอยู่ใน roadmap (${meta.roadmapEta ?? "TBA"}) — ติดต่อทีมเรากดเร่งคิวได้`,
      400,
    );
  }

  // Run the live test BEFORE persisting — if keys are wrong the seller
  // gets the error immediately and the DB stays clean.
  const test = await testConnection(input.provider, {
    publicKey: input.publicKey,
    secretKey: input.secretKey,
    mode: input.mode,
  });

  // Upsert: one row per (shopId, provider). If the seller is re-adding
  // the same provider, they overwrite (with a fresh test result + ts).
  const now = new Date();
  const row = await db.shopPaymentGateway.upsert({
    where: {
      shopId_provider: { shopId: shop.id, provider: input.provider },
    },
    create: {
      shopId: shop.id,
      provider: input.provider,
      mode: input.mode,
      publicKey: input.publicKey,
      secretKeyEncrypted: encryptSecret(input.secretKey),
      webhookSecretEncrypted: input.webhookSecret
        ? encryptSecret(input.webhookSecret)
        : null,
      label: input.label ?? null,
      enabled: test.ok,
      lastTestedAt: now,
      lastTestStatus: test.ok ? "OK" : "FAILED",
      lastTestMessage: test.ok
        ? test.accountLabel ?? null
        : test.errorMessage ?? null,
    },
    update: {
      mode: input.mode,
      publicKey: input.publicKey,
      secretKeyEncrypted: encryptSecret(input.secretKey),
      webhookSecretEncrypted: input.webhookSecret
        ? encryptSecret(input.webhookSecret)
        : null,
      label: input.label ?? null,
      enabled: test.ok,
      lastTestedAt: now,
      lastTestStatus: test.ok ? "OK" : "FAILED",
      lastTestMessage: test.ok
        ? test.accountLabel ?? null
        : test.errorMessage ?? null,
    },
  });

  return ok({
    id: row.id,
    provider: row.provider,
    mode: row.mode,
    test,
  });
}

function safeDecrypt(ciphertext: string): string {
  try {
    return decryptSecret(ciphertext);
  } catch {
    return "(decrypt failed)";
  }
}
