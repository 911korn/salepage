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

export type PlanKey = "pro" | "business";

export interface PlanDef {
  key: PlanKey;
  priceEnvVar: "STRIPE_PRICE_PRO" | "STRIPE_PRICE_BUSINESS";
  /** Days of free trial. 0 = no trial / immediate billing. */
  trialDays: number;
  /** Whether this plan can be self-served via Checkout. */
  selfService: boolean;
}

export const PLANS: Record<PlanKey, PlanDef> = {
  pro: {
    key: "pro",
    priceEnvVar: "STRIPE_PRICE_PRO",
    trialDays: 14,
    selfService: true,
  },
  business: {
    key: "business",
    priceEnvVar: "STRIPE_PRICE_BUSINESS",
    trialDays: 0,
    selfService: true,
  },
};

export function getPriceIdForPlan(key: PlanKey): string {
  const def = PLANS[key];
  const id = process.env[def.priceEnvVar];
  if (!id) {
    throw new Error(
      `${def.priceEnvVar} is not set. Run the Stripe provisioning script, then update Vercel env.`,
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
