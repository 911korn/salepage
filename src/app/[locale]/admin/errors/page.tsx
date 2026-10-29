import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";

const PAGE_SIZE = 50;
const SOURCES = ["server", "client"] as const;

interface SearchParams {
  source?: string;
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function AdminErrorsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const t = await getTranslations("adminErrors");
  const locale = await getLocale();
  const source = SOURCES.find((s) => s === sp.source) ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const where = source ? { source } : {};

  const [rows, total] = await Promise.all([
    db.errorEvent.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.errorEvent.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fmt = (d: Date) =>
    d.toLocaleString(locale === "th" ? "th-TH" : "en-US", { timeZone: "Asia/Bangkok" });
  const linkFor = (p: number) => {
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/errors?${qs}` : "/admin/errors";
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title={t("title")}
        description={t("description", { total: total.toLocaleString() })}
      />

      <form
        method="get"
        className="flex gap-2 rounded-2xl border border-zinc-200 bg-white p-3"
      >
        <select
          name="source"
          defaultValue={source}
          className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">{t("all")}</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {t(s)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white hover:bg-[color:var(--color-brand-700)]"
        >
          {t("filter")}
        </button>
      </form>

      <ul className="space-y-1.5">
        {rows.length === 0 ? (
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            {t("empty")}
          </li>
        ) : (
          rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5"
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-700">
                  {t(r.source === "client" ? "client" : "server")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-mono text-[13px] font-semibold text-zinc-900">
                    {r.message}
                  </p>
                  {r.path ? (
                    <p className="mt-0.5 break-all text-[12px] text-zinc-600">{r.path}</p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {t("first", { date: fmt(r.firstSeenAt) })} · {t("last", { date: fmt(r.lastSeenAt) })}
                  </p>
                  {r.stack ? (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-700">
                        {t("stack")}
                      </summary>
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-50 p-2.5 text-[11px] text-zinc-700">
                        {r.stack}
                      </pre>
                    </details>
                  ) : null}
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-[color:var(--color-brand-700)]">
                  {t("times", { count: r.count.toLocaleString() })}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-2 text-sm">
          <Link
            href={linkFor(Math.max(1, page - 1))}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {t("prev")}
          </Link>
          <span className="text-[12px] text-zinc-500">
            {t("page", { page, total: totalPages })}
          </span>
          <Link
            href={linkFor(Math.min(totalPages, page + 1))}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {t("next")}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}

export const dynamic = "force-dynamic";
