import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreditCard, ChevronRight, Globe } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { SlipCreditsCard } from "@/components/dashboard/slip-credits-card";
import { db } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop, dashboardHref } from "@/lib/dashboard-routing";
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

      <Link
        href={dashboardHref(
          "/dashboard/settings/payment-gateways",
          shop.slug,
        )}
        className="group flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white p-4 transition hover:border-[color:var(--color-brand-300)] hover:shadow-md"
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
          <CreditCard className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[14px] font-bold text-zinc-900 group-hover:text-[color:var(--color-brand-700)]">
            Payment Gateways
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-rose-600 to-amber-500 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-white">
              Pro+
            </span>
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Stripe · Omise · Ksher · 2C2P · GBPrimePay — รับบัตรเครดิต + alt-pay เพิ่มจาก PromptPay
          </p>
        </div>
        <ChevronRight className="size-4 text-zinc-400 group-hover:text-[color:var(--color-brand-700)]" />
      </Link>

      <Link
        href={dashboardHref("/dashboard/settings/domains", shop.slug)}
        className="group flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white p-4 transition hover:border-[color:var(--color-brand-300)] hover:shadow-md"
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
          <Globe className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[14px] font-bold text-zinc-900 group-hover:text-[color:var(--color-brand-700)]">
            Custom Domain
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-rose-600 to-amber-500 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-white">
              Pro+
            </span>
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            ใช้โดเมนของคุณเอง — เช่น mystore.com — พร้อม SSL + CDN ฟรีจาก Cloudflare
          </p>
        </div>
        <ChevronRight className="size-4 text-zinc-400 group-hover:text-[color:var(--color-brand-700)]" />
      </Link>

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
          pickupAddress: shop.pickupAddress,
          pickupPostcode: shop.pickupPostcode,
        }}
      />
    </div>
  );
}
