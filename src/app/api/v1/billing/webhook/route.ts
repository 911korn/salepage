import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // raw body access for signature verification

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: { code: "missing_secret", message: "STRIPE_WEBHOOK_SECRET not set" } },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: { code: "missing_signature", message: "stripe-signature header required" } },
      { status: 400 },
    );
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid signature";
    return NextResponse.json(
      { ok: false, error: { code: "bad_signature", message } },
      { status: 400 },
    );
  }

  // Audit log — once we have Prisma, persist events here for replay/debug.
  console.log(
    `[stripe-webhook] ${event.id} ${event.type} livemode=${event.livemode}`,
  );

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const plan = session.metadata?.plan;
      const subscription = session.subscription;
      const customer = session.customer;
      console.log(
        `[stripe-webhook]  checkout completed: plan=${plan} customer=${customer} subscription=${subscription}`,
      );
      // TODO when DB lands:
      //   - upsert User by email/session.customer_email
      //   - link User.stripe_customer_id = customer
      //   - upsert Subscription record with subscription.id + status + period
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      console.log(
        `[stripe-webhook]  subscription ${event.type.split(".").pop()}: id=${sub.id} status=${sub.status} customer=${sub.customer}`,
      );
      // TODO: sync Subscription record
      break;
    }
    case "customer.subscription.trial_will_end": {
      const sub = event.data.object;
      console.log(
        `[stripe-webhook]  trial ending soon: id=${sub.id} customer=${sub.customer}`,
      );
      // TODO: notify user via email / LINE OA
      break;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      console.log(
        `[stripe-webhook]  invoice ${event.type.split(".").pop()}: id=${invoice.id} customer=${invoice.customer} amount=${invoice.amount_paid}`,
      );
      // TODO: send receipt / dunning email
      break;
    }
    default:
      console.log(`[stripe-webhook]  unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ ok: true, received: true });
}
