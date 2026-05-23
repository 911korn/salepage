import {
  Activity,
  Building2,
  CreditCard,
  Package,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { KpiCard } from "@/components/admin/kpi-card";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { db, OrderStatus, PlanKey, SubscriptionStatus } from "@/lib/db";
import { getSlipOkQuota } from "@/lib/slip-verify";
import { getPlatformSetting } from "@/lib/platform-settings";

const PAID_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.SHIPPING,
  OrderStatus.DELIVERED,
];

const ACTIVE_SUB_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
];

// Stripe ฿/month per plan, used to estimate MRR.
const PLAN_MONTHLY_BAHT: Record<PlanKey, number> = {
  FREE: 0,
  STARTER: 199,
  PRO: 399,
  BUSINESS: 990,
  AGENCY: 2990,
};

export default async function AdminOverviewPage() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    totalShops,
    activeSubs,
    paidOrdersAll,
    paidOrdersToday,
    paidOrdersWeek,
    paidOrdersMonth,
    newUsersToday,
    newShopsToday,
    plansBreakdown,
    recentUsers,
    recentShops,
    recentOrders,
    recentEvents,
    slipQuota,
    announcement,
    maintenance,
  ] = await Promise.all([
    db.user.count(),
    db.shop.count(),
    db.subscription.findMany({
      where: { status: { in: ACTIVE_SUB_STATUSES } },
      select: { plan: true, currentPeriodEnd: true },
    }),
    db.order.aggregate({
      where: { status: { in: PAID_STATUSES } },
      _sum: { totalSatang: true },
      _count: true,
    }),
    db.order.aggregate({
      where: { status: { in: PAID_STATUSES }, createdAt: { gte: startOfDay } },
      _sum: { totalSatang: true },
      _count: true,
    }),
    db.order.aggregate({
      where: { status: { in: PAID_STATUSES }, createdAt: { gte: startOfWeek } },
      _sum: { totalSatang: true },
      _count: true,
    }),
    db.order.aggregate({
      where: { status: { in: PAID_STATUSES }, createdAt: { gte: startOfMonth } },
      _sum: { totalSatang: true },
      _count: true,
    }),
    db.user.count({ where: { createdAt: { gte: startOfDay } } }),
    db.shop.count({ where: { createdAt: { gte: startOfDay } } }),
    db.subscription.groupBy({
      by: ["plan"],
      where: { status: { in: ACTIVE_SUB_STATUSES } },
      _count: true,
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, email: true, name: true, createdAt: true, role: true },
    }),
    db.shop.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        slug: true,
        name: true,
        logoText: true,
        themeColor: true,
        createdAt: true,
        owner: { select: { email: true } },
      },
    }),
    db.order.findMany({
      where: { status: { in: PAID_STATUSES } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        publicToken: true,
        totalSatang: true,
        status: true,
        customerName: true,
        createdAt: true,
        shop: { select: { slug: true, name: true } },
      },
    }),
    db.stripeEvent.findMany({
      orderBy: { receivedAt: "desc" },
      take: 6,
      select: {
        id: true,
        type: true,
        receivedAt: true,
        processedAt: true,
        error: true,
      },
    }),
    getSlipOkQuota(),
    getPlatformSetting("announcement_banner"),
    getPlatformSetting("maintenance_mode"),
  ]);

  const mrrBaht = activeSubs.reduce(
    (sum, s) => sum + (PLAN_MONTHLY_BAHT[s.plan] ?? 0),
    0,
  );
  const gmvAllBaht = Math.round((paidOrdersAll._sum.totalSatang ?? 0) / 100);
  const gmvTodayBaht = Math.round((paidOrdersToday._sum.totalSatang ?? 0) / 100);
  const gmvWeekBaht = Math.round((paidOrdersWeek._sum.totalSatang ?? 0) / 100);
  const gmvMonthBaht = Math.round((paidOrdersMonth._sum.totalSatang ?? 0) / 100);

  const planMap = new Map<PlanKey, number>(
    plansBreakdown.map((p) => [p.plan, p._count]),
  );
  for (const k of Object.values(PlanKey)) {
    if (!planMap.has(k)) planMap.set(k, 0);
  }
  const failedEvents = recentEvents.filter(
    (e) => !e.processedAt || e.error,
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Overview"
        description={`สรุปสถานะแพลตฟอร์ม · ณ ${now.toLocaleString("th-TH")}`}
        actions={
          <Badge tone={maintenance.enabled ? "warning" : "success"} className="text-[11px]">
            <span className="size-1.5 rounded-full bg-current" />
            {maintenance.enabled ? "Maintenance ON" : "Live"}
          </Badge>
        }
      />

      {announcement.enabled && announcement.text ? (
        <div
          className={
            announcement.tone === "warning"
              ? "rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              : "rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900"
          }
        >
          <p className="font-semibold">Site-wide banner is LIVE</p>
          <p className="mt-0.5">{announcement.text}</p>
        </div>
      ) : null}

      {/* Top KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Total users"
          value={totalUsers.toLocaleString()}
          hint={`+${newUsersToday} วันนี้`}
          icon={Users}
          tone="violet"
        />
        <KpiCard
          label="Total shops"
          value={totalShops.toLocaleString()}
          hint={`+${newShopsToday} วันนี้`}
          icon={Building2}
          tone="brand"
        />
        <KpiCard
          label="Active subs"
          value={activeSubs.length.toLocaleString()}
          hint="Trial + Active"
          icon={CreditCard}
          tone="emerald"
        />
        <KpiCard
          label="MRR (est.)"
          value={`฿${mrrBaht.toLocaleString()}`}
          hint="From active plans"
          icon={TrendingUp}
          tone="emerald"
        />
        <KpiCard
          label="GMV all-time"
          value={`฿${gmvAllBaht.toLocaleString()}`}
          hint={`${paidOrdersAll._count} orders`}
          icon={Wallet}
          tone="amber"
        />
        <KpiCard
          label="Orders today"
          value={paidOrdersToday._count.toLocaleString()}
          hint={`฿${gmvTodayBaht.toLocaleString()} GMV`}
          icon={Package}
          tone="slate"
        />
      </section>

      {/* Periods */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Sales by period
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <PeriodCell label="วันนี้" amount={gmvTodayBaht} count={paidOrdersToday._count} />
            <PeriodCell label="7 วัน" amount={gmvWeekBaht} count={paidOrdersWeek._count} />
            <PeriodCell label="เดือนนี้" amount={gmvMonthBaht} count={paidOrdersMonth._count} />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Plan distribution
          </h2>
          <div className="mt-3 space-y-2">
            {(Object.values(PlanKey) as PlanKey[]).map((plan) => {
              const count = planMap.get(plan) ?? 0;
              const pct = activeSubs.length === 0 ? 0 : (count / activeSubs.length) * 100;
              return (
                <div key={plan} className="flex items-center gap-3">
                  <span className="w-20 text-[12px] font-medium text-zinc-700">
                    {plan}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-[color:var(--color-brand-500)]"
                      style={{ width: `${Math.max(pct, plan === "FREE" ? 0 : 2)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-[12px] text-zinc-500">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* System health row */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* SlipOK quota */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              SlipOK quota
            </h2>
            <Sparkles className="size-4 text-zinc-400" />
          </div>
          {slipQuota.ok ? (
            <>
              <p className="font-display mt-3 text-2xl font-bold">
                {(slipQuota.remaining ?? 0).toLocaleString()}
                <span className="ml-1 text-sm font-medium text-zinc-400">
                  / {(slipQuota.quota ?? 0).toLocaleString()}
                </span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={
                    (slipQuota.remaining ?? 0) <= (slipQuota.quota ?? 1) * 0.2
                      ? "h-full bg-amber-500"
                      : "h-full bg-emerald-500"
                  }
                  style={{
                    width: `${
                      slipQuota.quota
                        ? Math.max(2, ((slipQuota.remaining ?? 0) / slipQuota.quota) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500">
                Used {(slipQuota.used ?? 0).toLocaleString()}
                {slipQuota.expireDate
                  ? ` · expires ${new Date(slipQuota.expireDate).toLocaleDateString("th-TH")}`
                  : ""}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">{slipQuota.error}</p>
          )}
        </div>

        {/* Recent events health */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Stripe webhook health
            </h2>
            <Activity className="size-4 text-zinc-400" />
          </div>
          <p className="font-display mt-3 text-2xl font-bold">
            {recentEvents.length - failedEvents}
            <span className="ml-1 text-sm font-medium text-zinc-400">
              / {recentEvents.length} OK
            </span>
          </p>
          {recentEvents.length === 0 ? (
            <p className="mt-2 text-[12px] text-zinc-500">ยังไม่มี event เข้ามา</p>
          ) : (
            <Link
              href="/admin/events"
              className="mt-2 inline-block text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline"
            >
              ดู event ล่าสุด →
            </Link>
          )}
        </div>
      </section>

      {/* Recent activity */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ActivityCard
          title="ผู้ใช้ใหม่"
          href="/admin/users"
          empty="ยังไม่มีผู้ใช้ใหม่"
          items={recentUsers.map((u) => ({
            id: u.id,
            primary: u.name ?? u.email,
            secondary: u.email,
            meta: relativeTime(u.createdAt),
            tag: u.role !== "USER" ? u.role : undefined,
          }))}
        />

        <ActivityCard
          title="ร้านใหม่"
          href="/admin/shops"
          empty="ยังไม่มีร้านใหม่"
          items={recentShops.map((s) => ({
            id: s.id,
            primary: s.name,
            secondary: `/${s.slug} · ${s.owner.email}`,
            meta: relativeTime(s.createdAt),
            avatarText: s.logoText ?? s.name.slice(0, 1).toUpperCase(),
            avatarColor: s.themeColor,
          }))}
        />

        <ActivityCard
          title="ออเดอร์ล่าสุด"
          href="/admin/orders"
          empty="ยังไม่มีออเดอร์"
          items={recentOrders.map((o) => ({
            id: o.id,
            primary: o.customerName,
            secondary: `${o.shop.name} · ฿${(o.totalSatang / 100).toLocaleString()}`,
            meta: relativeTime(o.createdAt),
            tag: o.status,
          }))}
        />
      </section>
    </div>
  );
}

function PeriodCell({
  label,
  amount,
  count,
}: {
  label: string;
  amount: number;
  count: number;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="font-display mt-1 text-lg font-bold tracking-tight sm:text-xl">
        ฿{amount.toLocaleString()}
      </p>
      <p className="text-[11px] text-zinc-500">{count} orders</p>
    </div>
  );
}

interface ActivityItem {
  id: string;
  primary: string;
  secondary?: string;
  meta?: string;
  tag?: string;
  avatarText?: string;
  avatarColor?: string;
}

function ActivityCard({
  title,
  href,
  items,
  empty,
}: {
  title: string;
  href: string;
  items: ActivityItem[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="font-display text-sm font-semibold">{title}</h2>
        <Link
          href={href}
          className="text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline"
        >
          ดูทั้งหมด →
        </Link>
      </header>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-[13px] text-zinc-500">{empty}</div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50"
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
                style={{ background: item.avatarColor ?? "var(--color-brand-600)" }}
              >
                {item.avatarText ?? item.primary.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{item.primary}</p>
                {item.secondary ? (
                  <p className="truncate text-[11px] text-zinc-500">{item.secondary}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                {item.tag ? (
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                    {item.tag}
                  </span>
                ) : null}
                {item.meta ? (
                  <span className="text-[10px] text-zinc-400">{item.meta}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Suppress unused-icon lint to keep the import set tight for future expansions.
void ShoppingBag;

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString("th-TH", { month: "short", day: "numeric" });
}
