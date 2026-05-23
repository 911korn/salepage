import { AlertCircle, CheckCircle2, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";

const PAGE_SIZE = 50;

interface SearchParams {
  q?: string;
  status?: "ok" | "failed" | "pending";
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function AdminEventsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" as const } },
            { type: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status === "failed" ? { error: { not: null } } : {}),
    ...(status === "ok" ? { error: null, processedAt: { not: null } } : {}),
    ...(status === "pending" ? { processedAt: null } : {}),
  };

  const [events, total, failedCount] = await Promise.all([
    db.stripeEvent.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        livemode: true,
        receivedAt: true,
        processedAt: true,
        error: true,
      },
    }),
    db.stripeEvent.count({ where }),
    db.stripeEvent.count({ where: { error: { not: null } } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Stripe events"
        description={`${total.toLocaleString()} events · ${failedCount} ที่ผิดพลาด`}
      />

      <form
        method="get"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:grid-cols-4"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="evt_xxx, customer.subscription.updated"
          prefix={<Search className="size-4" />}
          className="h-10 col-span-2"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">ทุก status</option>
          <option value="ok">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending (no processedAt)</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white hover:bg-[color:var(--color-brand-700)]"
        >
          ค้นหา
        </button>
      </form>

      <ul className="space-y-1.5">
        {events.length === 0 ? (
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            ไม่พบ event
          </li>
        ) : (
          events.map((e) => {
            const failed = !!e.error;
            return (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5"
              >
                <span
                  className={
                    failed
                      ? "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-red-50 text-red-700"
                      : "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"
                  }
                >
                  {failed ? (
                    <AlertCircle className="size-3.5" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <code className="font-mono text-[13px] font-semibold">
                      {e.type}
                    </code>
                    {!e.livemode ? (
                      <Badge tone="warning" className="text-[10px]">
                        test
                      </Badge>
                    ) : null}
                    {!e.processedAt ? (
                      <Badge tone="warning" className="text-[10px]">
                        unprocessed
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-zinc-500">
                    {e.id}
                  </p>
                  {e.error ? (
                    <p className="mt-1 text-[12px] text-red-700">{e.error}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[11px] text-zinc-400">
                  {e.receivedAt.toLocaleString("th-TH")}
                </span>
              </li>
            );
          })
        )}
      </ul>

      {totalPages > 1 ? (
        <Pagination basePath="/admin/events" sp={sp} page={page} totalPages={totalPages} />
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
