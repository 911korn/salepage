import { Search, Star, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { ReviewRowActions } from "@/components/admin/review-row-actions";
import { db } from "@/lib/db";

const PAGE_SIZE = 50;

interface SearchParams {
  q?: string;
  rating?: string;
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function AdminReviewsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const ratingFilter = sp.rating ? Number(sp.rating) : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(q
      ? {
          OR: [
            { comment: { contains: q, mode: "insensitive" as const } },
            { customerName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(ratingFilter ? { rating: ratingFilter } : {}),
  };

  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        shop: {
          select: { id: true, slug: true, name: true, themeColor: true, logoText: true },
        },
        product: { select: { name: true, slug: true } },
      },
    }),
    db.review.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Reviews moderation"
        description={`${total.toLocaleString()} reviews`}
      />

      <form
        method="get"
        className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:flex-row"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="คำในรีวิว / ชื่อลูกค้า"
          prefix={<Search className="size-4" />}
          className="h-10 flex-1"
        />
        <select
          name="rating"
          defaultValue={sp.rating ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">ทุกดาว</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} ดาว
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white hover:bg-[color:var(--color-brand-700)]"
        >
          ค้นหา
        </button>
      </form>

      <ul className="space-y-2">
        {reviews.length === 0 ? (
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            ไม่พบรีวิว
          </li>
        ) : (
          reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <Link href={`/admin/shops/${r.shop.id}`} className="shrink-0">
                  <span
                    className="grid size-9 place-items-center rounded-xl text-xs font-bold text-white"
                    style={{ background: r.shop.themeColor }}
                  >
                    {r.shop.logoText ?? r.shop.name.slice(0, 1).toUpperCase()}
                  </span>
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{r.customerName}</span>
                    <span className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} className="size-3 fill-current" />
                      ))}
                    </span>
                    {r.reply ? <Badge tone="soft-brand">replied</Badge> : null}
                  </div>
                  <p className="mt-1 text-[12px] text-zinc-500">
                    <Link
                      href={`/admin/shops/${r.shop.id}`}
                      className="hover:text-zinc-700 hover:underline"
                    >
                      {r.shop.name}
                    </Link>
                    {r.product ? ` · ${r.product.name}` : ""}
                    {" · "}
                    {r.createdAt.toLocaleString("th-TH")}
                  </p>
                  {r.comment ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
                      {r.comment}
                    </p>
                  ) : null}
                  {r.reply ? (
                    <div className="mt-2 rounded-xl bg-zinc-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        ร้านตอบ
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-zinc-800">
                        {r.reply}
                      </p>
                    </div>
                  ) : null}
                </div>
                <ReviewRowActions reviewId={r.id} />
              </div>
            </li>
          ))
        )}
      </ul>

      {totalPages > 1 ? (
        <Pagination basePath="/admin/reviews" sp={sp} page={page} totalPages={totalPages} />
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
    if (sp.rating) params.set("rating", sp.rating);
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

void Trash2;
export const dynamic = "force-dynamic";
