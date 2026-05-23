import { ExternalLink, Search, Sparkles, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/page-header";
import { db, ShopStatus } from "@/lib/db";
import { storefrontLabel } from "@/lib/storefront-url";

const PAGE_SIZE = 50;

interface SearchParams {
  q?: string;
  status?: string;
  featured?: string;
  suspended?: string;
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function AdminShopsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status =
    sp.status && Object.values(ShopStatus).includes(sp.status as ShopStatus)
      ? (sp.status as ShopStatus)
      : undefined;
  const featured = sp.featured === "true" ? true : sp.featured === "false" ? false : undefined;
  const suspended = sp.suspended === "true" ? true : sp.suspended === "false" ? false : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(q
      ? {
          OR: [
            { slug: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { owner: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(featured !== undefined ? { featured } : {}),
    ...(suspended !== undefined ? { suspended } : {}),
  };

  const [shops, total] = await Promise.all([
    db.shop.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        name: true,
        logoText: true,
        themeColor: true,
        status: true,
        suspended: true,
        featured: true,
        verified: true,
        slipCredits: true,
        rating: true,
        totalSold: true,
        createdAt: true,
        owner: { select: { email: true, role: true } },
        _count: { select: { products: true, orders: true, reviews: true } },
      },
    }),
    db.shop.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Shops"
        description={`${total.toLocaleString()} shops total`}
      />

      {/* Filters */}
      <form
        method="get"
        className="grid grid-cols-1 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:grid-cols-5"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="slug, name, owner"
          prefix={<Search className="size-4" />}
          className="h-10 sm:col-span-2"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">All status</option>
          {Object.values(ShopStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="featured"
          defaultValue={sp.featured ?? ""}
          className="h-10 min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">All featured</option>
          <option value="true">Featured</option>
          <option value="false">Not featured</option>
        </select>
        <select
          name="suspended"
          defaultValue={sp.suspended ?? ""}
          className="h-10 min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">All</option>
          <option value="false">Active</option>
          <option value="true">Suspended</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white hover:bg-[color:var(--color-brand-700)] sm:col-span-5"
        >
          ค้นหา
        </button>
      </form>

      {/* Table — desktop */}
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Credits</th>
              <th className="px-4 py-3 text-right">—</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {shops.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                  ไม่พบร้าน
                </td>
              </tr>
            ) : (
              shops.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/shops/${s.id}`}
                      className="flex items-center gap-3"
                    >
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-white"
                        style={{ background: s.themeColor }}
                      >
                        {s.logoText ?? s.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="block truncate font-mono text-[11px] text-zinc-500">
                          {storefrontLabel(s.slug)}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-zinc-600">
                    {s.owner.email}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>
                        {s.status.toLowerCase()}
                      </Badge>
                      {s.suspended ? (
                        <Badge tone="warning" className="text-[10px]">
                          suspended
                        </Badge>
                      ) : null}
                      {s.featured ? (
                        <Badge tone="brand" className="text-[10px]">
                          <Sparkles className="size-3" /> featured
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {s._count.products}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {s._count.orders}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {s.slipCredits}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/shops/${s.id}`}
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
        {shops.length === 0 ? (
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            ไม่พบร้าน
          </li>
        ) : (
          shops.map((s) => (
            <li key={s.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <Link href={`/admin/shops/${s.id}`} className="block px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
                    style={{ background: s.themeColor }}
                  >
                    {s.logoText ?? s.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="truncate font-mono text-[11px] text-zinc-500">
                      {storefrontLabel(s.slug)} · {s.owner.email}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"} className="text-[10px]">
                    {s.status.toLowerCase()}
                  </Badge>
                  {s.suspended ? (
                    <Badge tone="warning" className="text-[10px]">suspended</Badge>
                  ) : null}
                  {s.featured ? (
                    <Badge tone="brand" className="text-[10px]">featured</Badge>
                  ) : null}
                  <span className="ml-auto text-[11px] text-zinc-500">
                    {s._count.products} ผ · {s._count.orders} ออเดอร์ · ⚡ {s.slipCredits}
                  </span>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>

      {totalPages > 1 ? (
        <Pagination basePath="/admin/shops" sp={sp} page={page} totalPages={totalPages} />
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
    if (sp.featured) params.set("featured", sp.featured);
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

void ExternalLink;
void Star;
