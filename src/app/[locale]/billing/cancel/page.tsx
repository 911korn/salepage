import { getTranslations, setRequestLocale } from "next-intl/server";
import { XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function CheckoutCancelPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("billing");

  return (
    <div className="min-h-screen bg-[color:var(--color-soft)]">
      <div className="container-page py-16 sm:py-24">
        <div className="mx-auto max-w-2xl rounded-3xl border border-[color:var(--color-border)] bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-zinc-100">
            <XCircle className="size-9 text-zinc-500" strokeWidth={2.25} />
          </div>
          <h1 className="font-display mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("cancel.title")}
          </h1>
          <p className="mt-4 text-balance text-[16px] leading-relaxed text-zinc-600 sm:text-lg">
            {t("cancel.desc")}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/#pricing"
              className={cn(buttonStyles({ size: "lg" }), "w-full sm:w-auto")}
            >
              {t("cancel.cta")}
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-[color:var(--color-fg)] hover:underline"
            >
              {t("cancel.ctaSecondary")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
