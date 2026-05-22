import { ok, fail } from "@/lib/api";
import { getStripe, PLANS, type PlanKey } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stripe = getStripe();
    const results = await Promise.all(
      (Object.keys(PLANS) as PlanKey[]).map(async (key) => {
        const priceId = process.env[PLANS[key].priceEnvVar];
        if (!priceId) return null;
        const price = await stripe.prices.retrieve(priceId, {
          expand: ["product"],
        });
        const product = price.product as { name?: string; description?: string | null };
        return {
          key,
          priceId,
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval,
          trialDays: PLANS[key].trialDays,
          productName: product?.name,
          productDescription: product?.description ?? null,
        };
      }),
    );
    return ok({ plans: results.filter(Boolean) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return fail("stripe_error", message, 500);
  }
}
