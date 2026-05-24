import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LogoLockup } from "@/components/ui/logo";
import { SignInForm } from "@/components/auth/sign-in-form";
import { auth } from "@/lib/auth";
import { normalizeDashboardCallbackUrl } from "@/lib/signin-callback";
import type { Locale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}

export default async function SignInPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { callbackUrl } = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  const normalizedCallbackUrl = normalizeDashboardCallbackUrl(callbackUrl, locale);

  if (session?.user) {
    redirect(normalizedCallbackUrl);
  }

  const t = await getTranslations("auth.signIn");

  const hasGoogle = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );
  const hasResend = Boolean(process.env.AUTH_RESEND_KEY);

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white">
      <div className="container-page py-12 sm:py-20">
        <div className="mx-auto max-w-md">
          <div className="flex justify-center">
            <Link href="/" className="inline-flex">
              <LogoLockup glow />
            </Link>
          </div>

          <div className="mt-8 rounded-3xl border border-[color:var(--color-border)] bg-white p-6 shadow-xl shadow-rose-100/40 sm:p-8">
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {t("title")}
              </h1>
              <p className="mt-2 text-[15px] text-zinc-600">{t("subtitle")}</p>
            </div>

            <div className="mt-7">
              <SignInForm
                callbackUrl={normalizedCallbackUrl}
                hasGoogle={hasGoogle}
                hasEmail={hasResend}
              />
            </div>

            <p className="mt-6 text-balance text-center text-[12px] leading-relaxed text-zinc-500">
              {locale === "th" ? (
                <>
                  การเข้าใช้บริการ ถือว่าคุณยอมรับ{" "}
                  <Link href="/terms" className="underline-offset-4 hover:underline">
                    {t("termsLink")}
                  </Link>
                  {" "}และ{" "}
                  <Link href="/privacy" className="underline-offset-4 hover:underline">
                    {t("privacyLink")}
                  </Link>
                  {" "}ของเรา
                </>
              ) : (
                <>
                  By continuing you agree to our{" "}
                  <Link href="/terms" className="underline-offset-4 hover:underline">
                    {t("termsLink")}
                  </Link>
                  {" "}and{" "}
                  <Link href="/privacy" className="underline-offset-4 hover:underline">
                    {t("privacyLink")}
                  </Link>
                  .
                </>
              )}
            </p>
          </div>

          <p className="mt-5 inline-flex w-full items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            {t("noAccount")}
          </p>
        </div>
      </div>
    </div>
  );
}
