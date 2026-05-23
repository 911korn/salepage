import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { getStripe } from "@/lib/stripe";
import type { Locale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ session_id?: string }>;
}

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("billing");
  const tCommon = await getTranslations("common");
  const { session_id } = await searchParams;

  let plan = "Pro";
  let trialDays = 0;
  let customerEmail: string | null = null;

  if (session_id) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["subscription"],
      });
      const meta = session.metadata?.plan;
      if (meta === "business") plan = "Business";
      else if (meta === "pro") plan = "Pro";
      customerEmail = session.customer_details?.email ?? null;
      const sub = session.subscription;
      if (sub && typeof sub !== "string" && sub.trial_end) {
        const now = Math.floor(new Date().getTime() / 1000);
        trialDays = Math.max(0, Math.round((sub.trial_end - now) / 86400));
      }
    } catch {
      // Soft-fail — show generic success without metadata.
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white">
      <div className="container-page py-16 sm:py-24">
        <div className="mx-auto max-w-2xl rounded-3xl border border-[color:var(--color-border)] bg-white p-8 text-center shadow-xl shadow-rose-100/40 sm:p-12">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50">
            <CheckCircle2 className="size-9 text-emerald-600" strokeWidth={2.5} />
          </div>
          <Badge tone="soft-brand" className="mt-5">
            <Sparkles className="size-3.5" /> {plan}
          </Badge>
          <h1 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("success.title", { plan })}
          </h1>
          <p className="mt-4 text-balance text-[16px] leading-relaxed text-zinc-600 sm:text-lg">
            {t("success.desc")}
          </p>

          {trialDays > 0 ? (
            <div className="mt-6 rounded-2xl border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] px-5 py-4 text-[14px] text-[color:var(--color-brand-800)]">
              {t("success.trialNote", { days: trialDays })}
            </div>
          ) : null}

          {customerEmail ? (
            <p className="mt-5 text-[13px] text-zinc-500">
              {t("success.receiptHint")} <strong>{customerEmail}</strong>
            </p>
          ) : null}

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className={cn(buttonStyles({ size: "lg" }), "w-full sm:w-auto")}
            >
              {t("success.cta")}
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-[color:var(--color-fg)] hover:underline"
            >
              {t("success.ctaSecondary")}
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-400">
          ref: {session_id ?? "—"} · {tCommon("verified")} via Stripe
        </p>
      </div>
    </div>
  );
}
