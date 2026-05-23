import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import {
  getStripe,
  PLANS,
  getPriceIdForPlan,
  getSiteUrl,
  stripeLocale,
  type PlanKey,
} from "@/lib/stripe";

const Body = z.object({
  plan: z.enum(["starter", "pro", "business", "agency"]),
  period: z.enum(["month", "year"]).optional().default("year"),
  email: z.string().email().optional(),
  locale: z.enum(["th", "en"]).optional().default("th"),
  shopSlug: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { plan, period, email, locale, shopSlug } = parsed.data;

  try {
    const stripe = getStripe();
    const priceId = getPriceIdForPlan(plan as PlanKey, period);
    const planDef = PLANS[plan as PlanKey];
    const base = getSiteUrl();
    const localePrefix = locale === "th" ? "" : `/${locale}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Stripe supports `card` for THB plus other local methods.
      // We rely on Stripe automatic_payment_methods to surface what's enabled
      // on the account (card + PromptPay when activated).
      automatic_tax: { enabled: false },
      billing_address_collection: "auto",
      customer_email: email,
      allow_promotion_codes: true,
      // SDK narrows this to a long string union; our helper returns a 3-value
      // subset Stripe accepts. Cast through `unknown` to avoid the exact
      // SDK type path (which has moved between minor SDK releases).
      locale: stripeLocale(locale) as unknown as undefined,
      subscription_data: {
        ...(planDef.trialDays > 0
          ? { trial_period_days: planDef.trialDays }
          : {}),
        metadata: {
          plan,
          period,
          locale,
          ...(shopSlug ? { shopSlug } : {}),
        },
      },
      metadata: {
        plan,
        period,
        locale,
        ...(shopSlug ? { shopSlug } : {}),
      },
      success_url: `${base}${localePrefix}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${localePrefix}/billing/cancel`,
    });

    if (!session.url) {
      return fail("stripe_no_url", "Stripe did not return a checkout URL", 500);
    }
    return ok({ url: session.url, sessionId: session.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return fail("stripe_error", message, 500);
  }
}
