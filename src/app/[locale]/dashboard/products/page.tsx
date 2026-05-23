import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus, ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { db, ProductBadge, ProductStatus, ProductType } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { CsvActions } from "@/components/dashboard/csv-actions";
import type { Locale } from "@/i18n/routing";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");
  const activeShop = shops[0];

  const products = await db.product.findMany({
    where: { shopId: activeShop.id },
    orderBy: { createdAt: "desc" },
  });

  const t = await getTranslations("dashboard.products");
  const tForm = await getTranslations("dashboard.products.form");

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("subtitle", { n: products.length })}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <CsvActions shopSlug={activeShop.slug} />
          <Link
            href="/dashboard/products/new"
            className={cn(buttonStyles({ size: "md" }), "flex-1 sm:flex-none")}
          >
            <Plus className="size-4" /> {t("addNew")}
          </Link>
        </div>
      </header>

      {products.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white p-10 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
            <ShoppingBag className="size-7" />
          </div>
          <h2 className="font-display mt-5 text-xl font-bold sm:text-2xl">
            {t("empty.title")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-balance text-[15px] text-zinc-600">
            {t("empty.desc")}
          </p>
          <Link
            href="/dashboard/products/new"
            className={cn(buttonStyles({ size: "lg" }), "mt-6")}
          >
            <Plus className="size-4" /> {t("empty.cta")}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                href={`/dashboard/products/${p.slug}/edit`}
                className="group block overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-md"
              >
                <div className="relative aspect-square w-full bg-[color:var(--color-soft)]">
                  {p.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrls[0]}
                      alt={p.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-zinc-400">
                      <ShoppingBag className="size-10" />
                    </div>
                  )}
                  {p.badge ? (
                    <span
                      className={cn(
                        "absolute left-2 top-2 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white",
                        p.badge === ProductBadge.HOT && "bg-orange-500",
                        p.badge === ProductBadge.NEW && "bg-emerald-500",
                        p.badge === ProductBadge.SALE && "bg-[color:var(--color-brand-600)]",
                      )}
                    >
                      {p.badge}
                    </span>
                  ) : null}
                  {p.status !== ProductStatus.ACTIVE ? (
                    <span className="absolute right-2 top-2 rounded-md bg-zinc-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                      {p.status === ProductStatus.HIDDEN
                        ? tForm("statusHidden")
                        : tForm("statusSoldOut")}
                    </span>
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-medium text-zinc-800 sm:text-[14px]">
                    {p.name}
                  </p>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-[color:var(--color-brand-700)]">
                      ฿{(p.priceSatang / 100).toLocaleString()}
                    </span>
                    {p.compareAtSatang ? (
                      <span className="text-[11px] text-zinc-400 line-through">
                        ฿{(p.compareAtSatang / 100).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                    <Badge tone="neutral" className="text-[10px]">
                      {p.type === ProductType.DIGITAL
                        ? tForm("typeDigital").replace(/\s*\(.*\)/, "")
                        : tForm("typePhysical").replace(/\s*\(.*\)/, "")}
                    </Badge>
                    <span>{p.sold} sold</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
