import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Bell,
  ChartBar,
  MessageCircle,
  Package,
  Plus,
  ShoppingBag,
  Star,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { db, OrderStatus } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { storefrontPath } from "@/lib/storefront-url";

export default async function DashboardOverviewPage() {
  const { shops } = await requireDashboardSession();

  // No shop yet → redirect to create-shop wizard.
  if (shops.length === 0) {
    redirect("/dashboard/create-shop");
  }

  const activeShop = shops[0];
  const t = await getTranslations("dashboard.overview");
  const tCommon = await getTranslations("dashboard.common");
  const tNav = await getTranslations("dashboard.nav");

  // Pull today's KPIs from DB in parallel.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todaySales, pendingCount, lowStockCount, recentOrders] = await Promise.all([
    db.order.aggregate({
      where: {
        shopId: activeShop.id,
        createdAt: { gte: startOfDay },
        status: { in: [OrderStatus.PAID, OrderStatus.SHIPPING, OrderStatus.DELIVERED] },
      },
      _sum: { totalSatang: true },
    }),
    db.order.count({
      where: { shopId: activeShop.id, status: OrderStatus.PENDING },
    }),
    db.product.count({
      where: { shopId: activeShop.id, stock: { lte: 5, gt: 0 } },
    }),
    db.order.findMany({
      where: { shopId: activeShop.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        publicToken: true,
        customerName: true,
        totalSatang: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const todayBaht = Math.round((todaySales._sum.totalSatang ?? 0) / 100);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">{t("greeting")}</p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("subtitle", { name: activeShop.name })}
        </h1>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <KpiCard
          label={t("todaySales")}
          value={`฿${todayBaht.toLocaleString()}`}
          note={t("todaySalesNote")}
          icon={Wallet}
          tone="brand"
        />
        <KpiCard
          label={t("pendingOrders")}
          value={String(pendingCount)}
          note={t("pendingOrdersNote")}
          icon={Package}
          tone="amber"
        />
        <KpiCard
          label={t("lowStock")}
          value={String(lowStockCount)}
          note={t("lowStockNote")}
          icon={ShoppingBag}
          tone="rose"
        />
      </div>

      {/* Quick tools */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {t("quickTools")}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <QuickTool href="/dashboard/analytics" icon={ChartBar} label={tNav("analytics")} />
          <QuickTool href="/dashboard/chat" icon={MessageCircle} label={tNav("chat")} />
          <QuickTool href="/dashboard/coupons" icon={Ticket} label={tNav("coupons")} />
          <QuickTool href="/dashboard/customers" icon={Users} label={tNav("customers")} />
          <QuickTool href="/dashboard/reviews" icon={Star} label={tNav("reviews")} />
          <QuickTool
            href="/dashboard/announcements"
            icon={Bell}
            label={tNav("announcements")}
          />
        </div>
      </section>

      {/* Recent orders */}
      <section className="rounded-2xl border border-[color:var(--color-border)] bg-white">
        <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-5 py-3.5">
          <h2 className="font-display text-base font-semibold">
            {t("recentOrders")}
          </h2>
          <Link
            href="/dashboard/orders"
            className="text-[13px] font-medium text-[color:var(--color-brand-700)] hover:underline"
          >
            {t("viewAll")} →
          </Link>
        </header>
        {recentOrders.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-[color:var(--color-soft)] text-zinc-400">
              <Package className="size-6" />
            </div>
            <p className="font-display mt-3 text-sm font-semibold">
              {t("noOrdersTitle")}
            </p>
            <p className="mt-1 text-[13px] text-zinc-500">{t("noOrdersDesc")}</p>
            <Link
              href={storefrontPath(activeShop.slug)}
              target="_blank"
              className={cn(buttonStyles({ size: "sm", variant: "outline" }), "mt-4")}
            >
              {tCommon("viewShop")}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--color-border)]">
            {recentOrders.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[color:var(--color-soft)]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
                  <Package className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.customerName}</p>
                  <p className="font-mono text-[11px] text-zinc-500">
                    {o.publicToken}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    ฿{(o.totalSatang / 100).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-zinc-500">{formatStatus(o.status)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Package;
  tone: "brand" | "amber" | "rose";
}) {
  const toneStyles: Record<typeof tone, string> = {
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
        <span
          className={cn(
            "grid size-8 place-items-center rounded-lg",
            toneStyles[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="font-display mt-3 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{note}</p>
    </div>
  );
}

function QuickTool({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof ChartBar;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-[color:var(--color-border)] bg-white px-3 py-3.5 text-center transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-md"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
        <Icon className="size-4" />
      </span>
      <span className="text-[12px] font-medium">{label}</span>
    </Link>
  );
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

// Suppress unused-var lint on `Plus` icon — kept for empty-state UI when adding sub-pages later.
void Plus;
