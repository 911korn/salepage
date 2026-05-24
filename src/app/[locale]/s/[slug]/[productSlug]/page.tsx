import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { CheckoutPanel } from "@/components/storefront/checkout-panel";
import { cn } from "@/lib/cn";
import { db, ProductStatus } from "@/lib/db";
import { getProduct as getDemoProduct, getShopBySlug as getDemoShop } from "@/lib/demo-data";
import { storefrontLabel, storefrontPath } from "@/lib/storefront-url";
import type { Locale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: Locale; slug: string; productSlug: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { locale, slug, productSlug } = await params;
  setRequestLocale(locale);

  const shop = await db.shop.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      logoText: true,
      logoUrl: true,
      themeColor: true,
      verified: true,
      status: true,
    },
  });

  let view:
    | {
        product: {
          slug: string;
          name: string;
          description: string | null;
          priceBaht: number;
          compareAtBaht: number | null;
          imageUrls: string[];
          badge: "HOT" | "NEW" | "SALE" | null;
          type: "PHYSICAL" | "DIGITAL";
          stock: number | null;
          sold: number;
        };
        shop: {
          slug: string;
          name: string;
          logoText: string | null;
          logoUrl: string | null;
          themeColor: string;
          verified: boolean;
        };
      }
    | null = null;

  if (shop && shop.status === "ACTIVE") {
    const p = await db.product.findUnique({
      where: { shopId_slug: { shopId: shop.id, slug: productSlug } },
    });
    if (p && p.status !== ProductStatus.HIDDEN) {
      view = {
        product: {
          slug: p.slug,
          name: p.name,
          description: p.description,
          priceBaht: Math.round(p.priceSatang / 100),
          compareAtBaht: p.compareAtSatang
            ? Math.round(p.compareAtSatang / 100)
            : null,
          imageUrls: p.imageUrls,
          badge: p.badge,
          type: p.type as "PHYSICAL" | "DIGITAL",
          stock: p.stock,
          sold: p.sold,
        },
        shop: {
          slug: shop.slug,
          name: shop.name,
          logoText: shop.logoText,
          logoUrl: shop.logoUrl,
          themeColor: shop.themeColor,
          verified: shop.verified,
        },
      };
    }
  }

  if (!view) {
    // Demo data fallback for landing's siam-snack preview
    const demoShop = getDemoShop(slug);
    const demoProduct = getDemoProduct(slug, productSlug);
    if (demoShop && demoProduct) {
      view = {
        product: {
          slug: demoProduct.slug,
          name: demoProduct.name,
          description: null,
          priceBaht: demoProduct.price,
          compareAtBaht: demoProduct.compareAt ?? null,
          // demo "images" are CSS gradients — use empty array, fallback UI handles it
          imageUrls: [],
          badge: (demoProduct.badge ?? null) as "HOT" | "NEW" | "SALE" | null,
          type: demoProduct.type === "digital" ? "DIGITAL" : "PHYSICAL",
          stock: demoProduct.stock ?? null,
          sold: demoProduct.sold,
        },
        shop: {
          slug: demoShop.slug,
          name: demoShop.name,
          logoText: demoShop.logo,
          logoUrl: null,
          themeColor: demoShop.themeColor,
          verified: demoShop.verified,
        },
      };
    }
  }

  if (!view) notFound();

  const { product, shop: shopView } = view;
  const discountPct =
    product.compareAtBaht && product.compareAtBaht > product.priceBaht
      ? Math.round(
          ((product.compareAtBaht - product.priceBaht) / product.compareAtBaht) * 100,
        )
      : 0;

  return (
    <div className="min-h-screen bg-[color:var(--color-soft)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-white/85 backdrop-blur-xl">
        <div className="container-page flex h-14 items-center justify-between">
          <Link
            href={storefrontPath(shopView.slug)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-[color:var(--color-fg)]"
          >
            <ArrowLeft className="size-4" /> {shopView.name}
          </Link>
          <p className="font-mono text-xs text-zinc-500">
            {storefrontLabel(shopView.slug, product.slug)}
          </p>
          <span />
        </div>
      </header>

      <div className="container-page py-6 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          {/* Image gallery */}
          <div className="overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white">
            <div className="relative aspect-square w-full bg-zinc-100">
              {product.imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrls[0]}
                  alt={product.name}
                  className="size-full object-cover"
                />
              ) : (
                <div
                  className="size-full"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-brand-100), var(--color-brand-300))",
                  }}
                />
              )}
              {product.badge ? (
                <span
                  className={cn(
                    "absolute left-3 top-3 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white",
                    product.badge === "HOT" && "bg-orange-500",
                    product.badge === "NEW" && "bg-emerald-500",
                    product.badge === "SALE" &&
                      "bg-[color:var(--color-brand-600)]",
                  )}
                >
                  {product.badge}
                </span>
              ) : null}
              {discountPct > 0 ? (
                <span className="absolute right-3 top-3 rounded-md bg-black/80 px-2.5 py-1 text-[11px] font-bold text-white">
                  -{discountPct}%
                </span>
              ) : null}
            </div>
            {product.imageUrls.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto p-3">
                {product.imageUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`${product.name} ${i + 1}`}
                    className="size-20 shrink-0 rounded-lg object-cover ring-1 ring-[color:var(--color-border)]"
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* Detail + checkout */}
          <div>
            <div className="rounded-3xl border border-[color:var(--color-border)] bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center gap-2">
                <Link
                  href={storefrontPath(shopView.slug)}
                  className="flex items-center gap-2 text-sm text-zinc-600 hover:text-[color:var(--color-fg)]"
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
                  <span className="font-medium">{shopView.name}</span>
                  {shopView.verified ? (
                    <ShieldCheck className="size-4 text-[color:var(--color-brand-600)]" />
                  ) : null}
                </Link>
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
