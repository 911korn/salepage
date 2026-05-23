import { Search, ShieldCheck, UserX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/page-header";
import { db, PlanKey, UserRole } from "@/lib/db";

const PAGE_SIZE = 50;

interface SearchParams {
  q?: string;
  role?: string;
  suspended?: string;
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const role = sp.role && Object.values(UserRole).includes(sp.role as UserRole)
    ? (sp.role as UserRole)
    : undefined;
  const suspended = sp.suspended === "true" ? true : sp.suspended === "false" ? false : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role ? { role } : {}),
    ...(suspended !== undefined ? { suspended } : {}),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        suspended: true,
        createdAt: true,
        subscription: { select: { plan: true, status: true } },
        _count: { select: { shops: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Users"
        description={`${total.toLocaleString()} users total`}
      />

      {/* Filters */}
      <form
        method="get"
        className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="ค้นหาด้วย email หรือชื่อ"
          prefix={<Search className="size-4" />}
          className="h-10 flex-1"
        />
        <select
          name="role"
          defaultValue={role ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">All roles</option>
          {Object.values(UserRole).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          name="suspended"
          defaultValue={sp.suspended ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">Active + suspended</option>
          <option value="false">Active only</option>
          <option value="true">Suspended only</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white hover:bg-[color:var(--color-brand-700)]"
        >
          ค้นหา
        </button>
      </form>

      {/* Table — desktop */}
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Shops</th>
              <th className="px-4 py-3">Signed up</th>
              <th className="px-4 py-3 text-right">—</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-zinc-500"
                >
                  ไม่พบผู้ใช้
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="flex items-center gap-3"
                    >
                      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-200 text-xs font-semibold uppercase text-zinc-600">
                        {u.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.image} alt="" className="size-full object-cover" />
                        ) : (
                          (u.name ?? u.email).trim().charAt(0)
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {u.name ?? u.email.split("@")[0]}
                        </span>
                        <span className="block truncate text-[12px] text-zinc-500">
                          {u.email}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                    {u.suspended ? (
                      <Badge tone="warning" className="ml-1.5 text-[10px]">
                        <UserX className="size-3" />
                        suspended
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <PlanBadge plan={u.subscription?.plan ?? PlanKey.FREE} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-zinc-600">
                    {u._count.shops}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-zinc-500">
                    {u.createdAt.toLocaleDateString("th-TH")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline"
                    >
                      เปิด →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <ul className="space-y-2 lg:hidden">
        {users.length === 0 ? (
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            ไม่พบผู้ใช้
          </li>
        ) : (
          users.map((u) => (
            <li
              key={u.id}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            >
              <Link href={`/admin/users/${u.id}`} className="block px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-200 text-sm font-semibold uppercase text-zinc-600">
                    {u.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.image} alt="" className="size-full object-cover" />
                    ) : (
                      (u.name ?? u.email).trim().charAt(0)
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {u.name ?? u.email.split("@")[0]}
                    </p>
                    <p className="truncate text-[12px] text-zinc-500">
                      {u.email}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={u.role} />
                  <PlanBadge plan={u.subscription?.plan ?? PlanKey.FREE} />
                  {u.suspended ? (
                    <Badge tone="warning" className="text-[10px]">
                      <UserX className="size-3" />
                      suspended
                    </Badge>
                  ) : null}
                  <span className="ml-auto text-[11px] text-zinc-500">
                    {u._count.shops} shops · {u.createdAt.toLocaleDateString("th-TH")}
                  </span>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>

      {/* Pagination */}
      {totalPages > 1 ? (
        <Pagination basePath="/admin/users" sp={sp} page={page} totalPages={totalPages} />
      ) : null}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  if (role === UserRole.SUPER_ADMIN) {
    return (
      <Badge tone="brand" className="text-[10px]">
        <ShieldCheck className="size-3" />
        SUPER
      </Badge>
    );
  }
  if (role === UserRole.ADMIN) {
    return (
      <Badge tone="soft-brand" className="text-[10px]">
        <ShieldCheck className="size-3" />
        ADMIN
      </Badge>
    );
  }
  return null;
}

function PlanBadge({ plan }: { plan: PlanKey }) {
  if (plan === PlanKey.FREE) {
    return (
      <Badge tone="neutral" className="text-[10px]">
        FREE
      </Badge>
    );
  }
  return (
    <Badge tone="soft-brand" className="text-[10px]">
      {plan}
    </Badge>
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
    if (sp.role) params.set("role", sp.role);
    if (sp.suspended) params.set("suspended", sp.suspended);
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
