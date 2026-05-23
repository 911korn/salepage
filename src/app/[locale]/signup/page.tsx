import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * /signup is treated as an alias for /signin — sign-in is the same flow for
 * brand-new users and returning users (NextAuth creates the User row on first
 * successful magic-link / Google sign-in). Keeping /signup as a separate URL
 * for marketing copy ("Create your shop") while sharing the actual UI.
 *
 * We preserve any `?plan=…` query param so the Stripe upgrade buttons can keep
 * working even when they bounce through /signup first.
 */
export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ plan?: string; callbackUrl?: string }>;
}) {
  const { locale } = await params;
  const { plan, callbackUrl } = await searchParams;
  const localePrefix = locale === "th" ? "" : `/${locale}`;
  const qs = new URLSearchParams();
  if (plan) qs.set("plan", plan);
  if (callbackUrl) qs.set("callbackUrl", callbackUrl);
  const tail = qs.toString();
  redirect(`${localePrefix}/signin${tail ? `?${tail}` : ""}`);
}
