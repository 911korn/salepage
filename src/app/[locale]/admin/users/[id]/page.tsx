import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Mail, Package } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { UserActions } from "@/components/admin/user-actions";
import { UserTierSelect } from "@/components/admin/user-tier-select";
import { requireAdmin } from "@/lib/admin";
import { db, OrderStatus, PlanKey, SubscriptionStatus, UserRole } from "@/lib/db";
import { storefrontLabel } from "@/lib/storefront-url";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  const viewer = await requireAdmin();

  const user = await db.user.findUnique({
    where: { id },
    include: {
      subscription: true,
      shops: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          logoText: true,
          themeColor: true,
          status: true,
          suspended: true,
          featured: true,
          _count: { select: { products: true, orders: true } },
        },
      },
      _count: { select: { sessions: true, accounts: true } },
    },
  });

  if (!user) {
    notFound();
  }

  const totalSpend = await db.order.aggregate({
    where: {
      shop: { ownerId: user.id },
      status: { in: [OrderStatus.PAID, OrderStatus.SHIPPING, OrderStatus.DELIVERED] },
    },
    _sum: { totalSatang: true },
    _count: true,
  });

  const totalSpendBaht = Math.round((totalSpend._sum.totalSatang ?? 0) / 100);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
      >
        <ArrowLeft className="size-3.5" /> Users
      </Link>

      <PageHeader
        title={user.name ?? user.email.split("@")[0]}
        description={user.email}
        actions={
          user.suspended ? (
            <Badge tone="warning">suspended</Badge>
          ) : (
            <Badge tone="success">active</Badge>
          )
        }
      />

      {/* Profile + actions */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-start gap-4">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-zinc-200 text-xl font-bold uppercase text-zinc-600">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="size-full object-cover" />
              ) : (
                (user.name ?? user.email).trim().charAt(0)
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-display text-xl font-bold">{user.name ?? "—"}</p>
              <p className="text-sm text-zinc-600">
                <Mail className="mr-1 inline size-3.5" />
                {user.email}
              </p>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge tone={user.role === UserRole.USER ? "neutral" : "brand"}>
                  {user.role}
                </Badge>
                {user.emailVerified ? (
                  <Badge tone="success">email verified</Badge>
                ) : (
                  <Badge tone="warning">not verified</Badge>
                )}
                {user.stripeCustomerId ? (
                  <Badge tone="soft-brand">Stripe linked</Badge>
                ) : null}
              </div>
              <p className="pt-1 text-[12px] text-zinc-500">
                Signed up {user.createdAt.toLocaleString("th-TH")}
                {user.stripeCustomerId
                  ? ` · Stripe ${user.stripeCustomerId}`
                  : ""}
              </p>
            </div>
          </div>
        </div>

        <UserActions
          viewerIsSuperAdmin={viewer.isSuperAdmin}
          viewerId={viewer.userId}
          user={{
            id: user.id,
            email: user.email,
            role: user.role,
            suspended: user.suspended,
          }}
        />
      </section>

      {/* Subscription */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-base font-semibold">Subscription</h2>
          <div className="w-full sm:w-72">
            <UserTierSelect
              userId={user.id}
              currentPlan={effectivePlan(user.subscription)}
              disabled={!viewer.isSuperAdmin}
            />
          </div>
        </div>
        {user.subscription ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Plan
              </dt>
              <dd className="mt-0.5 font-mono">{user.subscription.plan}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Status
              </dt>
              <dd className="mt-0.5 font-mono">{user.subscription.status}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Renews
              </dt>
              <dd className="mt-0.5">
                {user.subscription.currentPeriodEnd?.toLocaleDateString("th-TH") ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Auto-cancel
              </dt>
              <dd className="mt-0.5">
                {user.subscription.cancelAtPeriodEnd ? "Yes" : "No"}
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Stripe Subscription ID
              </dt>
              <dd className="mt-0.5 break-all font-mono text-[12px]">
                {user.subscription.stripeSubscriptionId}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            ผู้ใช้นี้ยังไม่ได้ subscribe (FREE plan)
          </p>
        )}
      </section>

      {/* Shops */}
      <section className="rounded-2xl border border-zinc-200 bg-white">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="font-display text-base font-semibold">
            ร้านของผู้ใช้ ({user.shops.length})
          </h2>
        </header>
        {user.shops.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-500">
            ผู้ใช้นี้ยังไม่มีร้าน
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {user.shops.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/shops/${s.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50"
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-white"
                    style={{ background: s.themeColor }}
                  >
                    {s.logoText ?? s.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {storefrontLabel(s.slug)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {s.featured ? <Badge tone="brand">featured</Badge> : null}
                    {s.suspended ? <Badge tone="warning">suspended</Badge> : null}
                    <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>
                      {s.status.toLowerCase()}
                    </Badge>
                    <span className="text-[11px] text-zinc-500">
                      <Package className="mr-0.5 inline size-3" />
                      {s._count.products} · {s._count.orders} orders
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Spend summary */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="font-display text-base font-semibold">
          ยอดขายรวม (ทุกร้านของผู้ใช้)
        </h2>
        <p className="font-display mt-2 text-2xl font-bold">
          ฿{totalSpendBaht.toLocaleString()}
        </p>
        <p className="mt-0.5 text-[12px] text-zinc-500">
          {totalSpend._count} paid/shipping/delivered orders
        </p>
      </section>

      <p className="text-center text-[11px] text-zinc-400">
        <Building2 className="inline size-3 align-text-bottom" /> User ID: {user.id}
      </p>
    </div>
  );
}

// Hint to Next: never cache an admin detail page.
export const dynamic = "force-dynamic";

function effectivePlan(
  sub:
    | {
        plan: PlanKey;
        status: SubscriptionStatus;
        currentPeriodEnd: Date | null;
      }
    | null
    | undefined,
) {
  if (!sub) return PlanKey.FREE;
  if (
    sub.status !== SubscriptionStatus.ACTIVE &&
    sub.status !== SubscriptionStatus.TRIALING
  ) {
    return PlanKey.FREE;
  }
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now()) {
    return PlanKey.FREE;
  }
  return sub.plan;
}
