import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { getStripe, getSiteUrl, stripeLocale } from "@/lib/stripe";

// Stripe doesn't allow PromptPay in mode:subscription. So for Thai users who
// want to pay with PromptPay, we offer a parallel mode:payment flow — one-time
// purchase that extends their plan by 30 days (month) or 365 days (year).
// Renewal is by re-paying; the webhook stitches the chunks together into a
// rolling Subscription record.

const Body = z.object({
  plan: z.enum(["pro", "business"]),
  period: z.enum(["month", "year"]).default("month"),
  email: z.string().email().optional(),
  locale: z.enum(["th", "en"]).optional().default("th"),
  shopSlug: z.string().optional(),
});

const PLAN_LABELS: Record<"pro" | "business", string> = {
  pro: "SalePage Pro",
  business: "SalePage Business",
};

const MONTHLY_THB: Record<"pro" | "business", number> = {
  pro: 299,
  business: 790,
};

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { plan, period, email, locale, shopSlug } = parsed.data;

  try {
    const stripe = getStripe();
    const base = getSiteUrl();
    const localePrefix = locale === "th" ? "" : `/${locale}`;

    // Annual = 10x monthly (2 months free)
    const monthly = MONTHLY_THB[plan];
    const amountTHB = period === "year" ? monthly * 10 : monthly;
    const amountSatang = amountTHB * 100;
    const periodLabel =
      period === "year" ? "1 ปี (ประหยัด 2 เดือน)" : "1 เดือน";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "thb",
            unit_amount: amountSatang,
            product_data: {
              name: `${PLAN_LABELS[plan]} · ${periodLabel}`,
              description:
                plan === "pro"
                  ? "Pro plan — unlimited products, AI slip verification, custom domain, VIP support"
                  : "Business plan — multi-shop, priority support, advanced analytics",
            },
          },
          quantity: 1,
        },
      ],
      payment_method_types: ["card", "promptpay"],
      customer_email: email,
      billing_address_collection: "auto",
      locale: stripeLocale(locale) as unknown as undefined,
      metadata: {
        plan,
        period,
        locale,
        oneTime: "true",
        ...(shopSlug ? { shopSlug } : {}),
      },
      payment_intent_data: {
        metadata: {
          plan,
          period,
          oneTime: "true",
          ...(shopSlug ? { shopSlug } : {}),
        },
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
