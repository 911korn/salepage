import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { db, OrderStatus } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import type { Locale } from "@/i18n/routing";

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");
  const activeShop = shops[0];

  const orders = await db.order.findMany({
    where: { shopId: activeShop.id },
    orderBy: { createdAt: "desc" },
    select: {
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      totalSatang: true,
      status: true,
      createdAt: true,
    },
  });

  // Group by phone-or-email as identity key.
  const customers = new Map<
    string,
    {
      key: string;
      name: string;
      phone: string | null;
      email: string | null;
      ordersCount: number;
      paidOrdersCount: number;
      totalSpentSatang: number;
      lastOrder: Date;
    }
  >();
  for (const o of orders) {
    const key = (o.customerPhone ?? o.customerEmail ?? `~${o.customerName}`).trim();
    if (!key) continue;
    const counts = o.status === OrderStatus.PAID ||
      o.status === OrderStatus.SHIPPING ||
      o.status === OrderStatus.DELIVERED;
    const existing = customers.get(key);
    if (existing) {
      existing.ordersCount++;
      if (counts) {
        existing.paidOrdersCount++;
        existing.totalSpentSatang += o.totalSatang;
      }
      if (o.createdAt > existing.lastOrder) existing.lastOrder = o.createdAt;
    } else {
      customers.set(key, {
        key,
        name: o.customerName,
        phone: o.customerPhone,
        email: o.customerEmail,
        ordersCount: 1,
        paidOrdersCount: counts ? 1 : 0,
        totalSpentSatang: counts ? o.totalSatang : 0,
        lastOrder: o.createdAt,
      });
    }
  }

  const customerList = Array.from(customers.values()).sort(
    (a, b) => b.totalSpentSatang - a.totalSpentSatang,
  );

  const t = await getTranslations("dashboard.customers");

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t("subtitle")} · {customerList.length.toLocaleString()}
        </p>
      </header>

      {customerList.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white p-10 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[color:var(--color-soft)] text-zinc-400">
            <Users className="size-7" />
          </div>
          <p className="mt-5 text-[15px] text-zinc-600">{t("empty")}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white">
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-soft)] text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">
                  {t("name")}
                </th>
                <th className="px-4 py-2.5 text-left font-semibold">
                  {t("contact")}
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  {t("ordersCount")}
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  {t("totalSpent")}
                </th>
                <th className="px-4 py-2.5 text-left font-semibold">
                  {t("lastOrder")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {customerList.map((c) => (
                <tr key={c.key} className="hover:bg-[color:var(--color-soft)]">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {c.phone ?? c.email ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.paidOrdersCount}/{c.ordersCount}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    ฿{(c.totalSpentSatang / 100).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-zinc-500">
                    {c.lastOrder.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-[color:var(--color-border)] md:hidden">
            {customerList.map((c) => (
              <li key={c.key} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {c.phone ?? c.email ?? "-"}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge tone="neutral" className="text-[10px]">
                      {c.paidOrdersCount}/{c.ordersCount} orders
                    </Badge>
                    <Badge tone="soft-brand" className="text-[10px]">
                      {c.lastOrder.toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
                <p className="text-base font-bold">
                  ฿{(c.totalSpentSatang / 100).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
