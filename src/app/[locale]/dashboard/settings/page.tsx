import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { SlipCreditsCard } from "@/components/dashboard/slip-credits-card";
import { db } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop } from "@/lib/dashboard-routing";
import { getShopSlipCapacity } from "@/lib/slip-credits";
import type { Locale } from "@/i18n/routing";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ shop?: string | string[] }>;
}) {
  const { locale } = await params;
  const { shop: shopParam } = await searchParams;
  setRequestLocale(locale);

  const { user, shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");
  const activeShop = resolveDashboardShop(shops, shopParam);
  if (!activeShop) redirect("/dashboard/create-shop");

  // Re-fetch with all editable fields
  const shop = await db.shop.findUnique({
    where: { id: activeShop.id },
  });
  if (!shop) redirect("/dashboard/create-shop");

  const t = await getTranslations("dashboard.settings");
  const capacity = await getShopSlipCapacity(shop.id, user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </header>

      <SlipCreditsCard shopSlug={shop.slug} capacity={capacity} />

      <SettingsForm
        shop={{
          slug: shop.slug,
          name: shop.name,
          description: shop.description,
          category: shop.category,
          themeColor: shop.themeColor,
          logoText: shop.logoText,
          logoUrl: shop.logoUrl,
          promptpayId: shop.promptpayId,
          contact: shop.contact as { phone?: string; line?: string; facebook?: string } | null,
          policies: shop.policies as { returnPolicy?: string; shippingTime?: string } | null,
        }}
      />
    </div>
  );
}
