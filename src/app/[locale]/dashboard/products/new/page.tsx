import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ProductForm } from "@/components/dashboard/product-form";
import { requireDashboardSession } from "@/lib/dashboard";
import type { Locale } from "@/i18n/routing";

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");
  const activeShop = shops[0];

  return <ProductForm mode="create" shopSlug={activeShop.slug} />;
}
