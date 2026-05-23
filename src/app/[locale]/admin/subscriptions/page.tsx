import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/page-header";
import { SubscriptionRowActions } from "@/components/admin/subscription-row-actions";
import { db, PlanKey, SubscriptionStatus } from "@/lib/db";

const PAGE_SIZE = 50;

interface SearchParams {
  q?: string;
  plan?: string;
  status?: string;
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

const STATUS_TONE: Record<SubscriptionStatus, "success" | "neutral" | "warning"> = {
  TRIALING: "success",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELED: "neutral",
  INCOMPLETE: "warning",
  INCOMPLETE_EXPIRED: "neutral",
  UNPAID: "warning",
  PAUSED: "neutral",
};

export default async function AdminSubscriptionsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const plan = sp.plan && Object.values(PlanKey).includes(sp.plan as PlanKey)
    ? (sp.plan as PlanKey)
    : undefined;
  const status =
    sp.status && Object.values(SubscriptionStatus).includes(sp.status as SubscriptionStatus)
      ? (sp.status as SubscriptionStatus)
      : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(plan ? { plan } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          user: {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const [subs, total] = await Promise.all([
    db.subscription.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    db.subscription.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Subscriptions"
        description={`${total.toLocaleString()} subscriptions`}
      />

      <form
        method="get"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:grid-cols-4"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="ค้นหาด้วย email"
          prefix={<Search className="size-4" />}
          className="h-10 col-span-2"
        />
        <select
          name="plan"
          defaultValue={plan ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">All plans</option>
          {Object.values(PlanKey).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">All status</option>
          {Object.values(SubscriptionStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="col-span-2 h-10 rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white hover:bg-[color:var(--color-brand-700)] sm:col-span-4"
        >
          ค้นหา
        </button>
      </form>

      {/* Table — desktop */}
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Renews</th>
              <th className="px-4 py-3">Stripe</th>
              <th className="px-4 py-3 text-right">—</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {subs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                  ไม่พบ subscription
                </td>
              </tr>
            ) : (
              subs.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${s.user.id}`}
                      className="block min-w-0"
                    >
                      <span className="block truncate font-medium">
                        {s.user.name ?? s.user.email.split("@")[0]}
                      </span>
                      <span className="block truncate text-[12px] text-zinc-500">
                        {s.user.email}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="soft-brand">{s.plan}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[s.status]}>{s.status.toLowerCase()}</Badge>
                    {s.cancelAtPeriodEnd ? (
                      <Badge tone="warning" className="ml-1 text-[10px]">
                        cancel pending
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    {s.currentPeriodEnd?.toLocaleDateString("th-TH") ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                    {s.stripeSubscriptionId.slice(0, 18)}…
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SubscriptionRowActions
                      subscription={{
                        id: s.id,
                        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <ul className="space-y-2 lg:hidden">
        {subs.length === 0 ? (
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            ไม่พบ subscription
          </li>
        ) : (
          subs.map((s) => (
            <li key={s.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <Link href={`/admin/users/${s.user.id}`} className="block">
                <p className="truncate font-medium">
                  {s.user.name ?? s.user.email.split("@")[0]}
                </p>
                <p className="truncate text-[12px] text-zinc-500">{s.user.email}</p>
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="soft-brand">{s.plan}</Badge>
                <Badge tone={STATUS_TONE[s.status]}>{s.status.toLowerCase()}</Badge>
                {s.cancelAtPeriodEnd ? (
                  <Badge tone="warning" className="text-[10px]">cancel pending</Badge>
                ) : null}
                <span className="ml-auto text-[11px] text-zinc-500">
                  ถึง {s.currentPeriodEnd?.toLocaleDateString("th-TH") ?? "—"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-[10px] text-zinc-400">
                  {s.stripeSubscriptionId.slice(0, 22)}…
                </span>
                <SubscriptionRowActions
                  subscription={{
                    id: s.id,
                    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
                  }}
                />
              </div>
            </li>
          ))
        )}
      </ul>

      {totalPages > 1 ? (
        <Pagination basePath="/admin/subscriptions" sp={sp} page={page} totalPages={totalPages} />
      ) : null}
    </div>
  );
}

function Pagination({
  basePath,
  sp,
  page,
  totalPages,
}: {
  basePath: string;
  sp: SearchParams;
  page: number;
  totalPages: number;
}) {
  const linkFor = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.plan) params.set("plan", sp.plan);
    if (sp.status) params.set("status", sp.status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav className="flex items-center justify-between gap-2 text-sm">
      <Link
        href={linkFor(Math.max(1, page - 1))}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
      >
        ← ก่อนหน้า
      </Link>
      <span className="text-[12px] text-zinc-500">
        Page {page} / {totalPages}
      </span>
      <Link
        href={linkFor(Math.min(totalPages, page + 1))}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
      >
        ถัดไป →
      </Link>
    </nav>
  );
}

export const dynamic = "force-dynamic";
