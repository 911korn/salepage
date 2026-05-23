import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { db } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import type { Locale } from "@/i18n/routing";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");
  const activeShop = shops[0];

  // Re-fetch with all editable fields
  const shop = await db.shop.findUnique({
    where: { id: activeShop.id },
  });
  if (!shop) redirect("/dashboard/create-shop");

  const t = await getTranslations("dashboard.settings");

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </header>
      <SettingsForm
        shop={{
          slug: shop.slug,
          name: shop.name,
          description: shop.description,
          category: shop.category,
          themeColor: shop.themeColor,
          logoText: shop.logoText,
          promptpayId: shop.promptpayId,
          contact: shop.contact as { phone?: string; line?: string; facebook?: string } | null,
          policies: shop.policies as { returnPolicy?: string; shippingTime?: string } | null,
        }}
      />
    </div>
  );
}
