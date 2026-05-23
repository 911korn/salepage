import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db, PlanKey, SubscriptionStatus } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // raw body access for signature verification

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return jsonErr("missing_secret", "STRIPE_WEBHOOK_SECRET not set", 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonErr("missing_signature", "stripe-signature header required", 400);
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid signature";
    return jsonErr("bad_signature", message, 400);
  }

  // Audit log — store every event we receive. Idempotent thanks to event.id PK.
  // If the row already existed AND processedAt is set, treat as duplicate and
  // skip handler (Stripe occasionally re-delivers). Critical for the
  // slip-credits and one-time-extend flows where running twice would
  // double-credit / double-extend.
  let alreadyProcessed = false;
  try {
    const existing = await db.stripeEvent.findUnique({
      where: { id: event.id },
      select: { processedAt: true },
    });
    if (existing?.processedAt) {
      alreadyProcessed = true;
    } else {
      await db.stripeEvent.upsert({
        where: { id: event.id },
        create: {
          id: event.id,
          type: event.type,
          livemode: event.livemode,
          // Stripe.Event isn't shaped as InputJsonValue; safe to round-trip via JSON.
          payload: JSON.parse(JSON.stringify(event)),
        },
        update: {}, // first-time row; never overwrite an already-recorded event
      });
    }
  } catch (e) {
    console.error("[stripe-webhook] failed to persist event log:", e);
  }

  if (alreadyProcessed) {
    return NextResponse.json({ ok: true, received: true, duplicate: true });
  }

  try {
    await handleEvent(event, stripe);
    await db.stripeEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    }).catch(() => {});
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[stripe-webhook] handler failed for ${event.type}:`, message);
    await db.stripeEvent
      .update({ where: { id: event.id }, data: { error: message } })
      .catch(() => {});
    // Still 200 so Stripe doesn't endlessly retry on a bug in our code; the
    // event log retains the error for manual replay.
  }

  return NextResponse.json({ ok: true, received: true });
}

async function handleEvent(event: Stripe.Event, stripe: Stripe) {
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(event.data.object, stripe);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await onSubscriptionChanged(event.data.object);
      break;
    case "customer.subscription.trial_will_end":
      // Future: send email or LINE OA reminder. Just log for now.
      console.log(
        `[stripe-webhook] trial ending: sub=${event.data.object.id}`,
      );
      break;
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      // Future: send receipt / dunning email
      break;
    default:
      // Unknown but recorded in StripeEvent for replay if needed.
      break;
  }
}

async function onCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
) {
  // (C) AI slip credit top-up — independent of user.subscription. Handled
  // first because it doesn't need to upsert User (the buyer always exists
  // before reaching the checkout — we authed them server-side).
  if (
    session.mode === "payment" &&
    session.metadata?.type === "slip-credits"
  ) {
    await creditSlipPack(session);
    return;
  }

  // mode:payment one-time PromptPay/card flow doesn't always have a
  // Stripe customer object — fall back to the customer_details on the session.
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) return;

  // Upsert user by email, link stripeCustomerId if present
  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      name: session.customer_details?.name ?? undefined,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
    },
    update: customerId ? { stripeCustomerId: customerId } : {},
  });

  // (A) Standard recurring subscription
  if (session.subscription) {
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subId);
    await upsertSubscription(user.id, subscription);
    return;
  }

  // (B) One-time payment (PromptPay or card via /api/v1/billing/checkout-once)
  if (session.mode === "payment" && session.metadata?.oneTime === "true") {
    await extendOneTimeSubscription(user.id, customerId, session);
  }
}

/// Increment shop.slipCredits by the pack amount on slip-credit checkout
/// completion. Webhook is idempotent — the same checkout.session.completed
/// event arriving twice would only credit once because Stripe's event log
/// upsert in handleEvent() short-circuits duplicates BEFORE we reach here.
async function creditSlipPack(session: Stripe.Checkout.Session) {
  const shopId = session.metadata?.shopId;
  const slips = Number(session.metadata?.slips ?? "0");
  if (!shopId || !Number.isFinite(slips) || slips <= 0) {
    console.warn(
      "[stripe-webhook] slip-credits session missing metadata:",
      session.id,
      session.metadata,
    );
    return;
  }
  const updated = await db.shop.update({
    where: { id: shopId },
    data: { slipCredits: { increment: slips } },
    select: { id: true, slug: true, slipCredits: true },
  });
  console.log(
    `[stripe-webhook] credited ${slips} slips to ${updated.slug} → total ${updated.slipCredits}`,
  );
}

async function extendOneTimeSubscription(
  userId: string,
  customerId: string | undefined,
  session: Stripe.Checkout.Session,
) {
  const planMeta = session.metadata?.plan;
  const periodMeta = session.metadata?.period ?? "month";
  const planKey =
    planMeta === "starter"
      ? PlanKey.STARTER
      : planMeta === "business"
        ? PlanKey.BUSINESS
        : planMeta === "agency"
          ? PlanKey.AGENCY
          : PlanKey.PRO;
  const days = periodMeta === "year" ? 365 : 30;

  // Roll the existing currentPeriodEnd forward if it's still active; otherwise
  // start fresh from now.
  const existing = await db.subscription.findUnique({ where: { userId } });
  const now = new Date();
  const baseTime =
    existing?.currentPeriodEnd && existing.currentPeriodEnd > now
      ? existing.currentPeriodEnd
      : now;
  const newPeriodEnd = new Date(
    baseTime.getTime() + days * 24 * 60 * 60 * 1000,
  );

  // Use session id as the "stripeSubscriptionId" since one-time payments
  // don't create a Stripe Subscription object. Prefixed so it's unmistakable.
  const fauxSubId = `onetime_${session.id}`;
  const fauxCustomerId = customerId ?? `onetime_email_${session.customer_email ?? "unknown"}`;

  await db.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: fauxSubId,
      stripeCustomerId: fauxCustomerId,
      plan: planKey,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: newPeriodEnd,
      cancelAtPeriodEnd: true, // one-time → won't auto-renew
    },
    update: {
      // Don't overwrite the original stripeSubscriptionId if user had a real
      // recurring sub before — just extend the active window.
      plan: planKey,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: newPeriodEnd,
      cancelAtPeriodEnd: true,
    },
  });
}

async function onSubscriptionChanged(subscription: Stripe.Subscription) {
  // Find the user by stripeCustomerId
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const user = await db.user.findUnique({
    where: { stripeCustomerId: customerId },
  });
  if (!user) {
    console.warn(
      `[stripe-webhook] subscription event for unknown customer ${customerId}`,
    );
    return;
  }
  await upsertSubscription(user.id, subscription);
}

async function upsertSubscription(userId: string, sub: Stripe.Subscription) {
  const planKey = mapPlan(sub);
  const status = mapStatus(sub.status);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const item = sub.items.data[0];
  const currentPeriodEndUnix = item?.current_period_end ?? null;

  await db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      userId,
      plan: planKey,
      status,
      currentPeriodEnd: currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000)
        : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    update: {
      plan: planKey,
      status,
      currentPeriodEnd: currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000)
        : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}

function mapPlan(sub: Stripe.Subscription): PlanKey {
  // Prefer metadata.plan (we set this on Checkout creation), fall back to price id lookup.
  const metaPlan = sub.metadata?.plan;
  if (metaPlan === "starter") return PlanKey.STARTER;
  if (metaPlan === "pro") return PlanKey.PRO;
  if (metaPlan === "business") return PlanKey.BUSINESS;
  if (metaPlan === "agency") return PlanKey.AGENCY;

  const priceId = sub.items.data[0]?.price?.id;
  // Check all month + year price IDs across all 4 paid tiers
  const PRICE_TO_PLAN: Record<string, PlanKey> = {};
  for (const tier of ["STARTER", "PRO", "BUSINESS", "AGENCY"] as const) {
    for (const period of ["MONTH", "YEAR"] as const) {
      const env = process.env[`STRIPE_PRICE_${tier}_${period}`];
      if (env) PRICE_TO_PLAN[env] = PlanKey[tier];
    }
  }
  // Legacy single-period env keys
  if (process.env.STRIPE_PRICE_PRO)
    PRICE_TO_PLAN[process.env.STRIPE_PRICE_PRO] = PlanKey.PRO;
  if (process.env.STRIPE_PRICE_BUSINESS)
    PRICE_TO_PLAN[process.env.STRIPE_PRICE_BUSINESS] = PlanKey.BUSINESS;

  if (priceId && PRICE_TO_PLAN[priceId]) return PRICE_TO_PLAN[priceId];
  return PlanKey.PRO; // safe default
}

function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "incomplete":
      return SubscriptionStatus.INCOMPLETE;
    case "incomplete_expired":
      return SubscriptionStatus.INCOMPLETE_EXPIRED;
    case "unpaid":
      return SubscriptionStatus.UNPAID;
    case "paused":
      return SubscriptionStatus.PAUSED;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

function jsonErr(code: string, message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status },
  );
}
