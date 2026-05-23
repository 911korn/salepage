import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ProductForm } from "@/components/dashboard/product-form";
import { db, type ProductBadge, type ProductStatus, type ProductType } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop } from "@/lib/dashboard-routing";
import type { Locale } from "@/i18n/routing";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; productSlug: string }>;
  searchParams: Promise<{ shop?: string | string[] }>;
}) {
  const { locale, productSlug } = await params;
  const { shop: shopParam } = await searchParams;
  setRequestLocale(locale);

  const { shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");
  const shop = resolveDashboardShop(shops, shopParam);
  if (!shop) redirect("/dashboard/create-shop");

  const product = await db.product.findUnique({
    where: { shopId_slug: { shopId: shop.id, slug: productSlug } },
  });
  if (!product) notFound();

  return (
    <ProductForm
      mode="edit"
      shopSlug={shop.slug}
      productSlug={product.slug}
      initialValues={{
        name: product.name,
        slug: product.slug,
        description: product.description,
        priceBaht: Math.round(product.priceSatang / 100),
        compareAtBaht: product.compareAtSatang
          ? Math.round(product.compareAtSatang / 100)
          : null,
        imageUrls: product.imageUrls,
        badge: product.badge as ProductBadge | null,
        type: product.type as ProductType,
        stock: product.stock,
        status: product.status as ProductStatus,
      }}
    />
  );
}
