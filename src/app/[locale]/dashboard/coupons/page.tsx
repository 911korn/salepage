import { Ticket } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import type { Locale } from "@/i18n/routing";

export default async function CouponsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard.nav");
  return <ComingSoon title={t("coupons")} icon={Ticket} />;
}
