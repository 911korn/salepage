import Stripe from "stripe";

const SECRET = process.env.STRIPE_SECRET_KEY;

/**
 * Server-only Stripe client. Module is cached per Node process by Next.js.
 * Throws on first use if the env var is missing (so misconfig fails loudly).
 */
let _client: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_client) {
    if (!SECRET) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to .env.local for dev, Vercel env for prod.",
      );
    }
    _client = new Stripe(SECRET, {
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
      appInfo: {
        name: "SalePage",
        url: "https://salepage.in.th",
      },
    });
  }
  return _client;
}

export type PlanKey = "starter" | "pro" | "business" | "agency";
export type BillingPeriod = "month" | "year";

export interface PlanDef {
  key: PlanKey;
  /** Monthly price in THB (for one-time PromptPay flow). Annual = 10x */
  monthlyTHB: number;
  /** Stripe price ID env-var prefixes: STRIPE_PRICE_{KEY}_{PERIOD} */
  trialDays: number;
  /** Whether this plan can be self-served via Checkout. */
  selfService: boolean;
  /** Display-only: product limit shown on pricing card. null = unlimited */
  productLimit: number | null;
  /** Monthly AI-slip verification quota included (0 = pay per slip) */
  slipsPerMonth: number;
}

export const PLANS: Record<PlanKey, PlanDef> = {
  starter: {
    key: "starter",
    monthlyTHB: 199,
    trialDays: 0,
    selfService: true,
    productLimit: 30,
    slipsPerMonth: 0,
  },
  pro: {
    key: "pro",
    monthlyTHB: 399,
    trialDays: 14,
    selfService: true,
    productLimit: 200,
    slipsPerMonth: 300,
  },
  business: {
    key: "business",
    monthlyTHB: 990,
    trialDays: 0,
    selfService: true,
    productLimit: 1000,
    slipsPerMonth: 1500,
  },
  agency: {
    key: "agency",
    monthlyTHB: 2990,
    trialDays: 0,
    selfService: true,
    productLimit: null,
    slipsPerMonth: 10000,
  },
};

/**
 * Look up Stripe price ID by plan + period.
 * Env vars STRIPE_PRICE_{KEY}_{MONTH|YEAR} were created via the
 * provisioning script — see .env.local for the live values.
 */
export function getPriceIdForPlan(
  key: PlanKey,
  period: BillingPeriod = "month",
): string {
  const envVar = `STRIPE_PRICE_${key.toUpperCase()}_${period.toUpperCase()}`;
  const id = process.env[envVar];
  if (!id) {
    throw new Error(
      `${envVar} is not set. Run the Stripe provisioning script, then update Vercel env.`,
    );
  }
  return id;
}

/**
 * Pick the public base URL for building Stripe return URLs.
 * Prefers NEXT_PUBLIC_SITE_URL, falls back to VERCEL_URL (preview deploys),
 * finally http://localhost:3030 for dev.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3030";
}

// Stripe Checkout's locale type is a long string union — we only need 3 values.
// Keep this as a narrowed string and cast at the call site to avoid coupling to
// the SDK's exact type-export path (which has moved between minor releases).
type CheckoutLocale = "th" | "en" | "auto";

const LOCALE_TO_STRIPE: Record<string, CheckoutLocale> = {
  th: "th",
  en: "en",
};

export function stripeLocale(locale: string | null | undefined): CheckoutLocale {
  if (locale && locale in LOCALE_TO_STRIPE) return LOCALE_TO_STRIPE[locale]!;
  return "auto";
}
