import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ProductForm } from "@/components/dashboard/product-form";
import { db, type ProductBadge, type ProductStatus, type ProductType } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import type { Locale } from "@/i18n/routing";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; productSlug: string }>;
}) {
  const { locale, productSlug } = await params;
  setRequestLocale(locale);

  const { shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");
  const shop = shops[0];

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
