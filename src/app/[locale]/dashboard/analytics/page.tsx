import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChartBar, Package, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { db, OrderStatus } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop } from "@/lib/dashboard-routing";
import type { Locale } from "@/i18n/routing";

const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.SHIPPING,
  OrderStatus.DELIVERED,
];

export default async function AnalyticsPage({
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

  const since = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const [orders, productSales] = await Promise.all([
    db.order.findMany({
      where: {
        shopId: activeShop.id,
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: since },
      },
      select: {
        id: true,
        createdAt: true,
        totalSatang: true,
        items: true,
      },
    }),
    db.product.findMany({
      where: { shopId: activeShop.id },
      orderBy: { sold: "desc" },
      take: 6,
      select: {
        slug: true,
        name: true,
        sold: true,
        priceSatang: true,
        imageUrls: true,
      },
    }),
  ]);

  // Daily revenue bucket for last 30 days
  const dayKey = (d: Date) =>
    [d.getFullYear(), d.getMonth(), d.getDate()].join("-");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { date: Date; revenueSatang: number; orders: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    days.push({ date: d, revenueSatang: 0, orders: 0 });
  }
  for (const o of orders) {
    const key = dayKey(o.createdAt);
    const day = days.find((d) => dayKey(d.date) === key);
    if (day) {
      day.revenueSatang += o.totalSatang;
      day.orders += 1;
    }
  }

  const totalRevenue = days.reduce((acc, d) => acc + d.revenueSatang, 0);
  const totalOrders = days.reduce((acc, d) => acc + d.orders, 0);
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const maxRevenue = Math.max(...days.map((d) => d.revenueSatang), 1);

  const t = await getTranslations("dashboard.analytics");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </header>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <KpiTile
          label={t("revenue")}
          value={`฿${(totalRevenue / 100).toLocaleString()}`}
          icon={Wallet}
          tone="brand"
        />
        <KpiTile
          label={t("orders")}
          value={totalOrders.toLocaleString()}
          icon={Package}
          tone="amber"
        />
        <KpiTile
          label={t("aov")}
          value={`฿${(aov / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
          tone="rose"
        />
      </div>

      {/* Revenue chart */}
      <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 sm:p-6">
        <header className="flex items-baseline justify-between">
          <h2 className="font-display text-base font-semibold">
            {t("last30")}
          </h2>
          {totalRevenue === 0 ? (
            <span className="text-[12px] text-zinc-500">{t("noData")}</span>
          ) : null}
        </header>

        <div className="mt-4 flex h-44 items-end gap-1">
          {days.map((d, i) => {
            const h = Math.max(2, (d.revenueSatang / maxRevenue) * 100);
            const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
            return (
              <div
                key={i}
                className="group relative flex flex-1 flex-col items-center justify-end"
                title={`${d.date.toLocaleDateString()} · ฿${(d.revenueSatang / 100).toLocaleString()} · ${d.orders} orders`}
              >
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all",
                    d.revenueSatang > 0
                      ? "bg-[color:var(--color-brand-600)] group-hover:bg-[color:var(--color-brand-700)]"
                      : isWeekend
                        ? "bg-zinc-100"
                        : "bg-[color:var(--color-soft)]",
                  )}
                  style={{ height: `${h}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
          <span>{days[0].date.toLocaleDateString()}</span>
          <span>{days[Math.floor(days.length / 2)].date.toLocaleDateString()}</span>
          <span>{days[days.length - 1].date.toLocaleDateString()}</span>
        </div>
      </section>

      {/* Top products */}
      <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 sm:p-6">
        <header>
          <h2 className="font-display text-base font-semibold">
            {t("topProducts")}
          </h2>
          <p className="text-[12px] text-zinc-500">{t("topProductsHint")}</p>
        </header>

        {productSales.length === 0 ? (
          <p className="mt-6 text-center text-sm text-zinc-500">
            {t("noData")}
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {productSales.map((p, i) => {
              const max = productSales[0].sold;
              const w = max > 0 ? (p.sold / max) * 100 : 0;
              return (
                <li key={p.slug} className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-100">
                    {p.imageUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrls[0]}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <ChartBar className="size-4 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-soft)]">
                      <div
                        className="h-full bg-[color:var(--color-brand-500)]"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {p.sold.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      ฿{(p.priceSatang / 100).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone={i === 0 ? "brand" : "neutral"} className="text-[10px]">
                    #{i + 1}
                  </Badge>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  tone: "brand" | "amber" | "rose";
}) {
  const toneClass: Record<typeof tone, string> = {
    brand: "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {label}
        </p>
        <span className={cn("grid size-8 place-items-center rounded-lg", toneClass[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="font-display mt-3 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
