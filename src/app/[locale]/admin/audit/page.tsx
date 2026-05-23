import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";

const PAGE_SIZE = 100;

interface SearchParams {
  q?: string;
  actorId?: string;
  targetType?: string;
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

const TARGET_TYPES = [
  "user",
  "shop",
  "subscription",
  "review",
  "coupon",
  "setting",
] as const;

export default async function AdminAuditPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const targetType = sp.targetType ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(q ? { action: { contains: q, mode: "insensitive" as const } } : {}),
    ...(sp.actorId ? { actorId: sp.actorId } : {}),
    ...(targetType ? { targetType } : {}),
  };

  const [rows, total] = await Promise.all([
    db.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        actor: { select: { id: true, email: true, name: true } },
      },
    }),
    db.adminAuditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Audit log"
        description={`${total.toLocaleString()} admin actions · append-only`}
      />

      <form
        method="get"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:grid-cols-4"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="action name"
          prefix={<Search className="size-4" />}
          className="h-10 col-span-2"
        />
        <select
          name="targetType"
          defaultValue={targetType}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">ทุก target</option>
          {TARGET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {sp.actorId ? (
          <input type="hidden" name="actorId" value={sp.actorId} />
        ) : null}
        <button
          type="submit"
          className="h-10 rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white hover:bg-[color:var(--color-brand-700)]"
        >
          ค้นหา
        </button>
      </form>

      {sp.actorId ? (
        <p className="text-[12px] text-zinc-600">
          Filtered by actor:{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">
            {sp.actorId}
          </code>{" "}
          <Link
            href="/admin/audit"
            className="ml-1 text-[color:var(--color-brand-700)] hover:underline"
          >
            ล้าง
          </Link>
        </p>
      ) : null}

      <ul className="space-y-1.5">
        {rows.length === 0 ? (
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            ยังไม่มี audit log
          </li>
        ) : (
          rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <code className="font-mono text-[13px] font-semibold text-[color:var(--color-brand-700)]">
                      {r.action}
                    </code>
                    {r.targetType ? (
                      <span className="text-[11px] text-zinc-500">
                        →{" "}
                        <Link
                          href={targetLinkFor(r.targetType, r.targetId)}
                          className="hover:underline"
                        >
                          {r.targetType}/{r.targetId?.slice(0, 12)}…
                        </Link>
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[12px] text-zinc-600">
                    by{" "}
                    <Link
                      href={`/admin/users/${r.actor.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.actor.email}
                    </Link>
                  </p>
                  {r.diff ? (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-700">
                        diff
                      </summary>
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-50 p-2.5 text-[11px] text-zinc-700">
                        {JSON.stringify(r.diff, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
                <span className="shrink-0 text-[10px] text-zinc-400">
                  {r.createdAt.toLocaleString("th-TH")}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>

      {totalPages > 1 ? (
        <Pagination basePath="/admin/audit" sp={sp} page={page} totalPages={totalPages} />
      ) : null}
    </div>
  );
}

function targetLinkFor(type: string, id: string | null): string {
  if (!id) return "#";
  switch (type) {
    case "user":
      return `/admin/users/${id}`;
    case "shop":
      return `/admin/shops/${id}`;
    case "subscription":
      return `/admin/subscriptions`;
    case "review":
      return `/admin/reviews`;
    case "coupon":
      return `/admin/coupons`;
    case "setting":
      return `/admin/settings`;
    default:
      return "#";
  }
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
    if (sp.actorId) params.set("actorId", sp.actorId);
    if (sp.targetType) params.set("targetType", sp.targetType);
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
