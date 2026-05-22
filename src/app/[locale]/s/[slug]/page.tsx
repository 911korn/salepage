import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, Star } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getShopBySlug } from "@/lib/demo-data";
import type { Locale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ slug: string; locale: Locale }>;
}

export default async function StorefrontPage({ params }: PageProps) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const shop = getShopBySlug(slug);
  if (!shop) notFound();

  const t = await getTranslations("shop");
  const tCommon = await getTranslations("common");

  return (
    <div className="min-h-screen bg-[color:var(--color-soft)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-white/85 backdrop-blur-xl">
        <div className="container-page flex h-14 items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-[color:var(--color-fg)]"
          >
            <ArrowLeft className="size-4" /> {t("back")}
          </Link>
          <p className="font-mono text-xs text-zinc-500">
            salepage.in.th/{shop.slug}
          </p>
          <Link href="/signup" className={cn(buttonStyles({ size: "sm" }))}>
            {t("createOwn")}
          </Link>
        </div>
      </header>

      <div className="relative">
        <div
          className="h-44 sm:h-56"
          style={{ background: shop.banners[0] }}
        />
        <div className="container-page -mt-16 sm:-mt-20">
          <div className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div
                  className="grid size-20 place-items-center rounded-2xl border-4 border-white font-display text-3xl font-bold text-white shadow-lg sm:size-24 sm:text-4xl"
                  style={{ background: shop.themeColor }}
                >
                  {shop.logo}
                </div>
                <div className="pb-1">
                  <div className="flex items-center gap-1.5">
                    <h1 className="font-display text-2xl font-bold sm:text-3xl">
                      {shop.name}
                    </h1>
                    {shop.verified ? (
                      <ShieldCheck className="size-5 text-[color:var(--color-brand-600)]" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">{shop.category}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">{tCommon("open")}</Badge>
                <Badge tone="soft-brand">
                  <Star className="size-3 fill-current" /> {shop.rating}
                </Badge>
                <Badge tone="neutral">
                  {t("sold")} {shop.totalSold.toLocaleString()}+
                </Badge>
              </div>
            </div>

            <p className="mt-5 text-[15px] leading-relaxed text-zinc-700">
              {shop.description}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-[color:var(--color-soft)] p-3 sm:grid-cols-3">
              <Stat label={t("products")} value={String(shop.productCount)} />
              <Stat label={t("rating")} value={`${shop.rating} / 5`} />
              <Stat
                label={t("sold")}
                value={`${shop.totalSold.toLocaleString()}+`}
                className="col-span-2 sm:col-span-1"
              />
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-bold sm:text-2xl">
                {t("allProducts")}
              </h2>
              <span className="text-sm text-zinc-500">
                {shop.products.length} {t("items")}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {shop.products.map((p) => (
                <Link
                  key={p.slug}
                  href={`/s/${shop.slug}/${p.slug}`}
                  className="group block overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-lg hover:shadow-rose-100/60"
                >
                  <div
                    className="relative aspect-square w-full"
                    style={{ background: p.image }}
                  >
                    {p.compareAt ? (
                      <span className="absolute left-2 top-2 rounded-md bg-black/80 px-2 py-1 text-[10px] font-bold text-white">
                        -{Math.round(((p.compareAt - p.price) / p.compareAt) * 100)}%
                      </span>
                    ) : null}
                    {p.badge ? (
                      <span
                        className={cn(
                          "absolute right-2 top-2 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white",
                          p.badge === "HOT" && "bg-orange-500",
                          p.badge === "NEW" && "bg-emerald-500",
                          p.badge === "SALE" && "bg-[color:var(--color-brand-600)]",
                        )}
                      >
                        {p.badge === "HOT" ? t("badgeHot") : p.badge === "NEW" ? t("badgeNew") : t("badgeSale")}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3 sm:p-4">
                    <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-medium text-zinc-800 sm:text-[14px]">
                      {p.name}
                    </p>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-[color:var(--color-brand-700)]">
                        ฿{p.price.toLocaleString()}
                      </span>
                      {p.compareAt ? (
                        <span className="text-[11px] text-zinc-400 line-through">
                          ฿{p.compareAt.toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-0.5",
                          p.type === "digital"
                            ? "border-violet-200 bg-violet-50 text-violet-700"
                            : "border-zinc-200 bg-zinc-50",
                        )}
                      >
                        {p.type === "digital" ? t("digital") : t("physical")}
                      </span>
                      <span>{t("soldCount", { n: p.sold.toLocaleString() })}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <footer className="mt-16 pb-10">
            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white p-5 text-center">
              <p className="text-sm text-zinc-600">
                {t.rich("poweredBy", {
                  brand: () => (
                    <Link
                      href="/"
                      className="font-semibold text-[color:var(--color-brand-700)] hover:underline"
                    >
                      SalePage
                    </Link>
                  ),
                })}
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white px-3 py-2.5 text-center ring-1 ring-[color:var(--color-border)]",
        className,
      )}
    >
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="font-display text-lg font-bold">{value}</p>
    </div>
  );
}
