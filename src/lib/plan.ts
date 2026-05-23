import { db, PlanKey, SubscriptionStatus } from "@/lib/db";

const BUSINESS_TIER: ReadonlySet<PlanKey> = new Set([
  PlanKey.BUSINESS,
  PlanKey.AGENCY,
]);

const ACTIVE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
]);

/**
 * Returns the effective plan for a user: their paid plan if their subscription
 * is active + within current period, else "free".
 *
 * Used by feature gates (LINE Messaging inbox, etc.) — the source of truth for
 * "can this user use feature X?". Never bypass this; always call the helper.
 */
export async function getEffectivePlan(userId: string): Promise<PlanKey> {
  const sub = await db.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  });
  if (!sub) return PlanKey.FREE;
  if (!ACTIVE_STATUSES.has(sub.status)) return PlanKey.FREE;
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now()) {
    return PlanKey.FREE;
  }
  return sub.plan;
}

/**
 * True iff the user is currently on BUSINESS or AGENCY (i.e. can use
 * LINE Messaging inbox + everything below).
 */
export async function hasBusinessPlan(userId: string): Promise<boolean> {
  const plan = await getEffectivePlan(userId);
  return BUSINESS_TIER.has(plan);
}
