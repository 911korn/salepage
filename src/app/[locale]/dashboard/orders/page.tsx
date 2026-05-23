import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Package } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { db, OrderStatus, type Prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { buildOrderRef } from "@/lib/orders";
import type { Locale } from "@/i18n/routing";

const FILTERS = [
  { key: "all", status: null },
  { key: "pending", status: OrderStatus.PENDING },
  { key: "paid", status: OrderStatus.PAID },
  { key: "shipping", status: OrderStatus.SHIPPING },
  { key: "delivered", status: OrderStatus.DELIVERED },
  { key: "cancelled", status: OrderStatus.CANCELLED },
] as const;

export default async function OrdersDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status: filterParam } = await searchParams;
  setRequestLocale(locale);

  const { shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");
  const activeShop = shops[0];

  const filter = FILTERS.find((f) => f.key === filterParam) ?? FILTERS[0];
  const where: Prisma.OrderWhereInput = { shopId: activeShop.id };
  if (filter.status) where.status = filter.status;

  const [orders, counts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.order.groupBy({
      by: ["status"],
      where: { shopId: activeShop.id },
      _count: { _all: true },
    }),
  ]);

  const totalByStatus: Record<string, number> = {};
  let grandTotal = 0;
  for (const c of counts) {
    totalByStatus[c.status] = c._count._all;
    grandTotal += c._count._all;
  }
  totalByStatus["all"] = grandTotal;

  const t = await getTranslations("dashboard.orders");

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {t("title")}
      </h1>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.key === "all"
              ? totalByStatus["all"] ?? 0
              : totalByStatus[f.status as string] ?? 0;
          return (
            <Link
              key={f.key}
              href={
                f.key === "all"
                  ? "/dashboard/orders"
                  : `/dashboard/orders?status=${f.key}`
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                filter.key === f.key
                  ? "border-[color:var(--color-brand-600)] bg-[color:var(--color-brand-600)] text-white"
                  : "border-[color:var(--color-border)] bg-white text-zinc-700 hover:border-[color:var(--color-brand-300)]",
              )}
            >
              {t(`filters.${f.key}`)}
              {count > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-semibold",
                    filter.key === f.key
                      ? "bg-white/20"
                      : "bg-[color:var(--color-soft)] text-zinc-600",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white p-10 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[color:var(--color-soft)] text-zinc-400">
            <Package className="size-7" />
          </div>
          <p className="mt-5 text-[15px] text-zinc-600">{t("empty")}</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white">
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-soft)] text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">
                  {t("headers.order")}
                </th>
                <th className="px-4 py-2.5 text-left font-semibold">
                  {t("headers.customer")}
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  {t("headers.total")}
                </th>
                <th className="px-4 py-2.5 text-left font-semibold">
                  {t("headers.status")}
                </th>
                <th className="px-4 py-2.5 text-left font-semibold">
                  {t("headers.time")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-[color:var(--color-soft)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/orders/${o.publicToken}`}
                      className="font-mono text-[12px] font-semibold text-[color:var(--color-brand-700)] hover:underline"
                    >
                      {buildOrderRef(o.createdAt, o.id)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.customerName}</p>
                    {o.customerPhone ? (
                      <p className="text-[11px] text-zinc-500">{o.customerPhone}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    ฿{(o.totalSatang / 100).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-[12px] text-zinc-500">
                    {o.createdAt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile cards */}
          <ul className="divide-y divide-[color:var(--color-border)] md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/dashboard/orders/${o.publicToken}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[color:var(--color-soft)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-mono text-[12px] font-semibold text-[color:var(--color-brand-700)]">
                        {buildOrderRef(o.createdAt, o.id)}
                      </p>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="truncate text-sm font-medium">{o.customerName}</p>
                    <p className="text-[11px] text-zinc-500">
                      {o.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-base font-bold">
                    ฿{(o.totalSatang / 100).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  if (status === OrderStatus.PENDING)
    return <Badge tone="warning" className="text-[10px]">PENDING</Badge>;
  if (status === OrderStatus.PAID)
    return <Badge tone="success" className="text-[10px]">PAID</Badge>;
  if (status === OrderStatus.SHIPPING)
    return <Badge tone="soft-brand" className="text-[10px]">SHIPPING</Badge>;
  if (status === OrderStatus.DELIVERED)
    return <Badge tone="success" className="text-[10px]">DELIVERED</Badge>;
  return <Badge tone="neutral" className="text-[10px]">{status}</Badge>;
}
