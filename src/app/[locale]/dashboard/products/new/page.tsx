import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ProductForm } from "@/components/dashboard/product-form";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop } from "@/lib/dashboard-routing";
import type { Locale } from "@/i18n/routing";

export default async function NewProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ shop?: string | string[] }>;
}) {
  const { locale } = await params;
  const { shop: shopParam } = await searchParams;
  setRequestLocale(locale);

  const { shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");
  const activeShop = resolveDashboardShop(shops, shopParam);
  if (!activeShop) redirect("/dashboard/create-shop");

  return <ProductForm mode="create" shopSlug={activeShop.slug} />;
}
