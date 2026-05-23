import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import type { Locale } from "@/i18n/routing";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal.terms");
  return (
    <LegalPage
      title={t("title")}
      lastUpdated={t("lastUpdated")}
      intro={t("intro")}
      sections={t.raw("sections") as Array<{ h: string; p: string }>}
    />
  );
}
