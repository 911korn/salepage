import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { CheckoutPanel } from "@/components/storefront/checkout-panel";
import { ProductImageGallery } from "@/components/storefront/product-image-gallery";
import { ShareButton } from "@/components/storefront/share-button";
import { getStorefrontProductView } from "@/lib/storefront-product-view";
import {
  absoluteStorefrontUrl,
  storefrontLabel,
  storefrontPath,
} from "@/lib/storefront-url";
import type { Locale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: Locale; slug: string; productSlug: string }>;
}

function metaDescription(product: {
  name: string;
  description: string | null;
  priceBaht: number;
}, shopName: string) {
  const price = `฿${product.priceBaht.toLocaleString("th-TH")}`;
  const text = product.description?.replace(/\s+/g, " ").trim();
  if (text) {
    return `${price} · ${text}`.slice(0, 180);
  }

  return `สั่งซื้อ ${product.name} ราคา ${price} จากร้าน ${shopName} ได้ทันทีบน SalePage`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, productSlug, locale } = await params;
  const view = await getStorefrontProductView(slug, productSlug);

  if (!view) {
    return {};
  }

  const { product, shop } = view;
  const productUrl = absoluteStorefrontUrl(shop.slug, product.slug);
  const ogImageUrl = new URL(
    `/api/v1/og/product/${encodeURIComponent(shop.slug)}/${encodeURIComponent(
      product.slug,
    )}?v=${product.updatedAtMs}`,
    "https://salepage.in.th",
  ).toString();
  const description = metaDescription(product, shop.name);
  const title = `${product.name} - ฿${product.priceBaht.toLocaleString(
    "th-TH",
  )} | ${shop.name}`;

  return {
    title,
    description,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title,
      description,
      url: productUrl,
      siteName: "SalePage",
      type: "website",
      locale: locale === "th" ? "th_TH" : "en_US",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${product.name} จากร้าน ${shop.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { locale, slug, productSlug } = await params;
  setRequestLocale(locale);

  const view = await getStorefrontProductView(slug, productSlug);

  if (!view) notFound();

  const { product, shop: shopView } = view;
  const productUrl = absoluteStorefrontUrl(shopView.slug, product.slug);
  const shareText = metaDescription(product, shopView.name);
  const discountPct =
    product.compareAtBaht && product.compareAtBaht > product.priceBaht
      ? Math.round(
          ((product.compareAtBaht - product.priceBaht) / product.compareAtBaht) * 100,
        )
      : 0;

  return (
    <div className="min-h-screen bg-[color:var(--color-soft)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-white/85 backdrop-blur-xl">
        <div className="container-page flex h-14 min-w-0 items-center gap-3">
          <Link
            href={storefrontPath(shopView.slug)}
            className="inline-flex min-w-0 max-w-[48%] items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-[color:var(--color-fg)]"
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span className="truncate">{shopView.name}</span>
          </Link>
          <p className="min-w-0 flex-1 truncate text-right font-mono text-xs text-zinc-500">
            {storefrontLabel(shopView.slug, product.slug)}
          </p>
        </div>
      </header>

      <div className="container-page py-6 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <ProductImageGallery
            images={product.imageUrls}
            productName={product.name}
            badge={product.badge}
            discountPct={discountPct}
          />

          {/* Detail + checkout */}
          <div>
            <div className="rounded-3xl border border-[color:var(--color-border)] bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={storefrontPath(shopView.slug)}
                  className="flex min-w-0 items-center gap-2 pt-1 text-sm text-zinc-600 hover:text-[color:var(--color-fg)]"
                >
                  <span
                    className="grid size-7 place-items-center overflow-hidden rounded-lg font-display text-xs font-bold text-white"
                    style={{ background: shopView.themeColor }}
                  >
                    {shopView.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shopView.logoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      shopView.logoText ?? shopView.name.slice(0, 1)
                    )}
                  </span>
                  <span className="truncate font-medium">{shopView.name}</span>
                  {shopView.verified ? (
                    <ShieldCheck className="size-4 shrink-0 text-[color:var(--color-brand-600)]" />
                  ) : null}
                </Link>
                <ShareButton title={product.name} text={shareText} url={productUrl} />
              </div>

              <h1 className="font-display mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                {product.name}
              </h1>

              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold text-[color:var(--color-brand-700)] sm:text-4xl">
                  ฿{product.priceBaht.toLocaleString()}
                </span>
                {product.compareAtBaht ? (
                  <span className="text-lg text-zinc-400 line-through">
                    ฿{product.compareAtBaht.toLocaleString()}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="neutral" className="text-[11px]">
                  {product.type === "DIGITAL" ? "DIGITAL" : "PHYSICAL"}
                </Badge>
                <Badge tone="neutral" className="text-[11px]">
                  ขาย {product.sold.toLocaleString()}
                </Badge>
                {product.stock !== null ? (
                  <Badge
                    tone={product.stock > 5 ? "success" : "warning"}
                    className="text-[11px]"
                  >
                    {product.stock > 0
                      ? `เหลือ ${product.stock}`
                      : "หมดสต๊อก"}
                  </Badge>
                ) : null}
              </div>

              {product.description ? (
                <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-zinc-700">
                  {product.description}
                </p>
              ) : null}
            </div>

            <div className="mt-4">
              <CheckoutPanel
                shopSlug={shopView.slug}
                product={{
                  slug: product.slug,
                  name: product.name,
                  priceBaht: product.priceBaht,
                  type: product.type,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
