import { getTranslations, setRequestLocale } from "next-intl/server";
import { Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LogoLockup } from "@/components/ui/logo";
import type { Locale } from "@/i18n/routing";

export const metadata = {
  title: "เช็คอีเมล · SalePage",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function CheckEmailPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.signIn");

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white">
      <div className="container-page py-16 sm:py-24">
        <div className="mx-auto max-w-md">
          <div className="flex justify-center">
            <Link href="/" className="inline-flex">
              <LogoLockup />
            </Link>
          </div>
          <div className="mt-8 rounded-3xl border border-[color:var(--color-border)] bg-white p-8 text-center shadow-xl shadow-rose-100/40 sm:p-10">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
              <Mail className="size-9" strokeWidth={2.25} />
            </div>
            <h1 className="font-display mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("sentTitle")}
            </h1>
            <p className="mt-3 text-balance text-[15px] leading-relaxed text-zinc-600 sm:text-base">
              {t("sentDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
