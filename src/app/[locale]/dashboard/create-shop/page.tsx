import { setRequestLocale } from "next-intl/server";
import { CreateShopWizard } from "@/components/dashboard/create-shop-wizard";
import type { Locale } from "@/i18n/routing";

export default async function CreateShopPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-2xl">
      <CreateShopWizard />
    </div>
  );
}
