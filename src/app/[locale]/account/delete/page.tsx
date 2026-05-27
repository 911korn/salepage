import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Mail, ShieldCheck, Trash2 } from "lucide-react";
import type { Locale } from "@/i18n/routing";

/**
 * Public account-deletion page — exists so Google Play's Data Safety form
 * can point at a stable web URL where any user (signed-in or not) can
 * ask for their data to be deleted. Required by Play policy since
 * December 2023.
 *
 * - Signed-in users are pointed to the in-app delete button (Apple
 *   5.1.1(v) parity).
 * - Anyone else (lost-phone / can't-sign-in / never-signed-up-but-data-
 *   collected case) gets a mailto link with a pre-filled subject so
 *   our support team can act manually.
 *
 * No interactive form — Google's reviewer just verifies the URL is
 * reachable + describes the deletion process.
 */
export const metadata: Metadata = {
  title: "ลบบัญชี SalePage · Delete account",
  description:
    "Request deletion of your SalePage account and associated data. Available to all users, signed-in or not.",
  alternates: {
    canonical: "https://salepage.in.th/account/delete",
    languages: {
      th: "https://salepage.in.th/account/delete",
      en: "https://salepage.in.th/en/account/delete",
      "x-default": "https://salepage.in.th/account/delete",
    },
  },
  // Allow indexing — Play reviewer + buyers should be able to find this.
  robots: { index: true, follow: true },
};

interface Props {
  params: Promise<{ locale: Locale }>;
}

export default async function AccountDeletePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "accountDelete" });

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50/40 via-white to-white">
      <div className="container-page py-12 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <div className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-700">
            <Trash2 className="size-7" />
          </div>

          <h1 className="font-display mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-balance text-[15px] leading-relaxed text-zinc-600">
            {t("intro")}
          </p>

          {/* Path A — in-app (the primary path, satisfies Apple 5.1.1(v)) */}
          <section className="mt-8 rounded-3xl border border-[color:var(--color-border)] bg-white p-6 sm:p-7">
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">
                  {t("inAppTitle")}
                </h2>
                <p className="mt-1 text-[14px] leading-relaxed text-zinc-600">
                  {t("inAppBody")}
                </p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-zinc-700">
                  <li>{t("step1")}</li>
                  <li>{t("step2")}</li>
                  <li>{t("step3")}</li>
                  <li>{t("step4")}</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Path B — email (for users who can't sign in) */}
          <section className="mt-4 rounded-3xl border border-[color:var(--color-border)] bg-white p-6 sm:p-7">
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <Mail className="size-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-lg font-bold">
                  {t("emailTitle")}
                </h2>
                <p className="mt-1 text-[14px] leading-relaxed text-zinc-600">
                  {t("emailBody")}
                </p>
                <a
                  href="mailto:ceo@911.co.th?subject=Account%20deletion%20request%20%E2%80%93%20SalePage&body=Hello%20SalePage%20Support%2C%0A%0A(1)%20Please%20delete%20my%20SalePage%20account%20and%20all%20associated%20data.%0A%0A(2)%20Email%20I%20signed%20up%20with%3A%20%5Byour-email%40example.com%5D%0A(3)%20Approximate%20signup%20date%3A%20%5Byyyy-mm-dd%5D%0A%0AThank%20you."
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  <Mail className="size-4" />
                  ceo@911.co.th
                </a>
              </div>
            </div>
          </section>

          {/* What gets deleted */}
          <section className="mt-4 rounded-3xl border border-[color:var(--color-border)] bg-white p-6 sm:p-7">
            <h2 className="font-display text-lg font-bold">{t("scopeTitle")}</h2>
            <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-zinc-700">
              <li>· {t("scope1")}</li>
              <li>· {t("scope2")}</li>
              <li>· {t("scope3")}</li>
              <li>· {t("scope4")}</li>
              <li>· {t("scope5")}</li>
            </ul>
            <p className="mt-4 text-[12px] leading-relaxed text-zinc-500">
              {t("retention")}
            </p>
          </section>

          <div className="mt-8 text-center text-[13px] text-zinc-500">
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              {t("privacyLink")}
            </Link>
            {" · "}
            <Link href="/contact" className="underline-offset-4 hover:underline">
              {t("contactLink")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
