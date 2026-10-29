import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const Body = z.object({ action: z.enum(["cancel", "resume"]) });

/** POST /api/v1/billing/subscription { action: "cancel" | "resume" }
 *
 *  Cancel = stop auto-renew at the end of the paid period (the seller keeps
 *  what they paid for); resume undoes it before that date. Done directly on
 *  the Stripe subscription so it never depends on the hosted portal's
 *  configuration. The webhook also syncs this; we write the row now so the
 *  dashboard reflects it immediately. */
export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { action } = parsed.data;

  const sub = await db.subscription.findUnique({
    where: { userId: session.user.id },
  });
  if (!sub) {
    return fail("no_subscription", "บัญชีนี้ยังไม่มีแพ็กเกจที่ต่ออายุอัตโนมัติ", 404);
  }
  // One-time annual payments and team-granted plans never auto-renew,
  // so there is nothing to cancel on Stripe.
  if (!sub.stripeSubscriptionId.startsWith("sub_")) {
    return fail(
      "not_recurring",
      "แพ็กเกจนี้ไม่มีการต่ออายุอัตโนมัติ จึงไม่ต้องยกเลิก",
      400,
    );
  }
  if (sub.status === "CANCELED" || sub.status === "INCOMPLETE_EXPIRED") {
    return fail("already_ended", "แพ็กเกจนี้สิ้นสุดไปแล้ว", 400);
  }

  try {
    const updated = await getStripe().subscriptions.update(
      sub.stripeSubscriptionId,
      { cancel_at_period_end: action === "cancel" },
    );
    const row = await db.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: updated.cancel_at_period_end },
    });
    return ok({
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    });
  } catch (e) {
    console.error("[billing/subscription]", action, e instanceof Error ? e.message : e);
    return fail(
      "billing_update_failed",
      "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง หรือติดต่อทีมงานผ่านหน้าช่วยเหลือ",
      502,
    );
  }
}
