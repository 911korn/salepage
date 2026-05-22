import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { getStripe, getSiteUrl } from "@/lib/stripe";

const Body = z.object({
  customerId: z.string().startsWith("cus_").optional(),
  email: z.string().email().optional(),
  locale: z.enum(["th", "en"]).optional().default("th"),
});

export async function POST(request: Request) {
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { customerId, email, locale } = parsed.data;
  if (!customerId && !email) {
    return fail(
      "missing_identity",
      "Provide either customerId or email of an existing Stripe customer",
      400,
    );
  }

  try {
    const stripe = getStripe();
    let cus = customerId;
    if (!cus && email) {
      const list = await stripe.customers.list({ email, limit: 1 });
      if (list.data.length === 0) {
        return fail("customer_not_found", "No Stripe customer with that email", 404);
      }
      cus = list.data[0].id;
    }
    const base = getSiteUrl();
    const localePrefix = locale === "th" ? "" : `/${locale}`;
    const portal = await stripe.billingPortal.sessions.create({
      customer: cus!,
      return_url: `${base}${localePrefix}/`,
    });
    return ok({ url: portal.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return fail("stripe_error", message, 500);
  }
}
