import { resolveSession } from "@/lib/api-auth";
import { ok } from "@/lib/api";
import { db } from "@/lib/db";

/**
 * POST /api/v1/me/delete-account
 *
 * In-app account deletion endpoint required by Apple App Store Review
 * Guideline 5.1.1(v) — any app that lets a user create an account MUST
 * let them delete it from the app itself, with comparable ease to
 * signing up.
 *
 * Semantics:
 *  - **Soft delete**: we set User.deletedAt = now() and BLANK every
 *    piece of PII (email, name, image, lineUserId, expoPushToken) atomically.
 *  - **NOT a hard delete**: rows in Order / Review / Dispute / Payout
 *    reference the user via foreign keys we don't want to break — buyers
 *    can still see their past orders and the seller's order list still
 *    shows the (anonymised) customer.
 *  - **Email is rewritten** to `deleted-{cuid}@deleted.salepage.in.th`
 *    so the `@unique` constraint is preserved and the same email can
 *    be reused for a fresh signup later.
 *  - **NextAuth Account + Session rows** for this user are deleted so
 *    the OAuth provider link is severed — a re-signup with the same
 *    Google account creates a new User row.
 *  - **Shops owned by this user**: marked `suspended = true` (storefront
 *    returns 503). The seller can dispute via support; full hard-
 *    delete is admin-gated to avoid accidental shop wipe-outs.
 *
 * After this endpoint returns, the mobile client clears its
 * SecureStore JWT and reloads the JS bundle. The user lands on the
 * guest /me view.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const userId = session.user.id;
  const now = new Date();
  const deletedEmail = `deleted-${userId}@deleted.salepage.in.th`;

  await db.$transaction(async (tx) => {
    // 1. Sever OAuth links — next signup is a fresh User row.
    await tx.account.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    // 2. Suspend shops owned by this user so storefronts go dark.
    await tx.shop.updateMany({
      where: { ownerId: userId },
      data: { suspended: true },
    });
    // 3. Wipe PII + flip the soft-delete flag.
    await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: now,
        email: deletedEmail,
        name: null,
        image: null,
        lineUserId: null,
        expoPushToken: null,
      },
    });
  });

  return ok({ deleted: true, deletedAt: now.toISOString() });
}
