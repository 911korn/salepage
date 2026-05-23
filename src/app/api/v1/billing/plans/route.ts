import { ok, fail } from "@/lib/api";
import {
  getStripe,
  getPriceIdForPlan,
  PLANS,
  type PlanKey,
  type BillingPeriod,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stripe = getStripe();
    const keys = Object.keys(PLANS) as PlanKey[];
    const periods: BillingPeriod[] = ["month", "year"];

    const results = await Promise.all(
      keys.flatMap((key) =>
        periods.map(async (period) => {
          let priceId: string;
          try {
            priceId = getPriceIdForPlan(key, period);
          } catch {
            return null;
          }
          const price = await stripe.prices.retrieve(priceId, {
            expand: ["product"],
          });
          const product = price.product as {
            name?: string;
            description?: string | null;
          };
          return {
            key,
            period,
            priceId,
            amount: price.unit_amount,
            currency: price.currency,
            interval: price.recurring?.interval,
            trialDays: PLANS[key].trialDays,
            productName: product?.name,
            productDescription: product?.description ?? null,
            productLimit: PLANS[key].productLimit,
            slipsPerMonth: PLANS[key].slipsPerMonth,
          };
        }),
      ),
    );
    return ok({ plans: results.filter(Boolean) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return fail("stripe_error", message, 500);
  }
}
