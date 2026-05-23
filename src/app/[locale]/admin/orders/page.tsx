import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/page-header";
import { db, OrderStatus } from "@/lib/db";

const PAGE_SIZE = 50;

interface SearchParams {
  q?: string;
  status?: string;
  shopId?: string;
  from?: string;
  to?: string;
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

const STATUS_TONE: Record<OrderStatus, "neutral" | "success" | "warning" | "soft-brand"> = {
  PENDING: "warning",
  PAID: "success",
  SHIPPING: "soft-brand",
  DELIVERED: "success",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
};

export default async function AdminOrdersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status =
    sp.status && Object.values(OrderStatus).includes(sp.status as OrderStatus)
      ? (sp.status as OrderStatus)
      : undefined;
  const shopId = sp.shopId?.trim() || undefined;
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(sp.to) : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(q
      ? {
          OR: [
            { publicToken: { contains: q, mode: "insensitive" as const } },
            { customerName: { contains: q, mode: "insensitive" as const } },
            { customerPhone: { contains: q } },
            { customerEmail: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(shopId ? { shopId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [orders, total, sum] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        publicToken: true,
        totalSatang: true,
        status: true,
        customerName: true,
        customerPhone: true,
        createdAt: true,
        shop: {
          select: { id: true, slug: true, name: true, themeColor: true, logoText: true },
        },
      },
    }),
    db.order.count({ where }),
    db.order.aggregate({ where, _sum: { totalSatang: true } }),
  ]);

  const sumBaht = Math.round((sum._sum.totalSatang ?? 0) / 100);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Orders"
        description={`${total.toLocaleString()} orders · ยอดรวม ฿${sumBaht.toLocaleString()}`}
      />

      {/* Filters */}
      <form
        method="get"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:grid-cols-6"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="token, ชื่อลูกค้า, เบอร์"
          prefix={<Search className="size-4" />}
          className="h-10 col-span-2"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">All status</option>
          {Object.values(OrderStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          name="from"
          type="date"
          defaultValue={sp.from ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        />
        <input
          name="to"
          type="date"
          defaultValue={sp.to ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        />
        {sp.shopId ? (
          <input type="hidden" name="shopId" value={sp.shopId} />
        ) : null}
        <button
          type="submit"
          className="h-10 rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white hover:bg-[color:var(--color-brand-700)]"
        >
          ค้นหา
        </button>
      </form>

      {shopId ? (
        <div className="flex items-center gap-2 text-[12px] text-zinc-600">
          <span>Filtered by shopId:</span>
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">{shopId}</code>
          <Link href="/admin/orders" className="text-[color:var(--color-brand-700)] hover:underline">
            ล้าง
          </Link>
        </div>
      ) : null}

      {/* Table — desktop */}
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                  ไม่พบออเดอร์
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <a
                      href={`/o/${o.publicToken}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[12px] text-[color:var(--color-brand-700)] hover:underline"
                    >
                      {o.publicToken.slice(0, 12)}…
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/shops/${o.shop.id}`}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="grid size-6 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white"
                        style={{ background: o.shop.themeColor }}
                      >
                        {o.shop.logoText ?? o.shop.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="truncate text-[13px]">{o.shop.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[13px]">{o.customerName}</p>
                    {o.customerPhone ? (
                      <p className="font-mono text-[11px] text-zinc-500">
                        {o.customerPhone}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] font-semibold">
                    ฿{(o.totalSatang / 100).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[o.status]}>{o.status.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-zinc-500">
                    {o.createdAt.toLocaleString("th-TH")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <ul className="space-y-2 lg:hidden">
        {orders.length === 0 ? (
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            ไม่พบออเดอร์
          </li>
        ) : (
          orders.map((o) => (
            <li key={o.id} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={`/o/${o.publicToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-[color:var(--color-brand-700)] hover:underline"
                >
                  {o.publicToken.slice(0, 14)}…
                </a>
                <Badge tone={STATUS_TONE[o.status]} className="text-[10px]">
                  {o.status.toLowerCase()}
                </Badge>
              </div>
              <p className="mt-1 text-[14px] font-medium">{o.customerName}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <Link
                  href={`/admin/shops/${o.shop.id}`}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <span
                    className="grid size-5 shrink-0 place-items-center rounded text-[8px] font-bold text-white"
                    style={{ background: o.shop.themeColor }}
                  >
                    {o.shop.logoText ?? o.shop.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-[12px] text-zinc-600">
                    {o.shop.name}
                  </span>
                </Link>
                <span className="font-mono text-[14px] font-bold">
                  ฿{(o.totalSatang / 100).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-right text-[10px] text-zinc-400">
                {o.createdAt.toLocaleString("th-TH")}
              </p>
            </li>
          ))
        )}
      </ul>

      {totalPages > 1 ? (
        <Pagination basePath="/admin/orders" sp={sp} page={page} totalPages={totalPages} />
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
    if (sp.shopId) params.set("shopId", sp.shopId);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
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
