import { Search, TicketX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/page-header";
import { CouponRowActions } from "@/components/admin/coupon-row-actions";
import { CouponType, db } from "@/lib/db";

const PAGE_SIZE = 50;

interface SearchParams {
  q?: string;
  active?: string;
  type?: string;
  page?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function AdminCouponsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const active = sp.active === "true" ? true : sp.active === "false" ? false : undefined;
  const type: CouponType | undefined =
    sp.type === "PERCENT"
      ? CouponType.PERCENT
      : sp.type === "FIXED"
        ? CouponType.FIXED
        : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { shop: { slug: { contains: q, mode: "insensitive" as const } } },
            { shop: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(active !== undefined ? { active } : {}),
    ...(type ? { type } : {}),
  };

  const [coupons, total] = await Promise.all([
    db.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        shop: {
          select: { id: true, slug: true, name: true, themeColor: true, logoText: true },
        },
      },
    }),
    db.coupon.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Coupons"
        description={`${total.toLocaleString()} coupons · moderation only · ร้านสร้างเองที่ /dashboard/coupons`}
      />

      <form
        method="get"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:grid-cols-4"
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="โค้ด / ชื่อร้าน"
          prefix={<Search className="size-4" />}
          className="h-10 col-span-2"
        />
        <select
          name="active"
          defaultValue={sp.active ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">ทุกสถานะ</option>
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </select>
        <select
          name="type"
          defaultValue={sp.type ?? ""}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">ทุกประเภท</option>
          <option value="PERCENT">PERCENT</option>
          <option value="FIXED">FIXED</option>
        </select>
        <button
          type="submit"
          className="col-span-2 h-10 rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white hover:bg-[color:var(--color-brand-700)] sm:col-span-4"
        >
          ค้นหา
        </button>
      </form>

      {/* List */}
      <ul className="space-y-2">
        {coupons.length === 0 ? (
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
            ไม่พบคูปอง
          </li>
        ) : (
          coupons.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3"
            >
              <Link href={`/admin/shops/${c.shop.id}`} className="shrink-0">
                <span
                  className="grid size-9 place-items-center rounded-xl text-xs font-bold text-white"
                  style={{ background: c.shop.themeColor }}
                >
                  {c.shop.logoText ?? c.shop.name.slice(0, 1).toUpperCase()}
                </span>
              </Link>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-sm font-bold uppercase">
                    {c.code}
                  </span>
                  <Badge tone="soft-brand" className="text-[10px]">
                    {c.type === "PERCENT" ? `${c.percent}%` : `฿${(c.amountSatang ?? 0) / 100}`}
                  </Badge>
                  {!c.active ? (
                    <Badge tone="warning" className="text-[10px]">disabled</Badge>
                  ) : null}
                  {c.expiresAt && c.expiresAt.getTime() < Date.now() ? (
                    <Badge tone="neutral" className="text-[10px]">expired</Badge>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-zinc-500">
                  <Link href={`/admin/shops/${c.shop.id}`} className="hover:underline">
                    {c.shop.name}
                  </Link>
                  {c.minOrderSatang
                    ? ` · min ฿${(c.minOrderSatang / 100).toLocaleString()}`
                    : ""}
                  {c.maxRedemptions
                    ? ` · ${c.redeemedCount}/${c.maxRedemptions}`
                    : ` · used ${c.redeemedCount}×`}
                  {c.expiresAt ? ` · หมด ${c.expiresAt.toLocaleDateString("th-TH")}` : ""}
                </p>
              </div>
              <CouponRowActions coupon={{ id: c.id, active: c.active }} />
            </li>
          ))
        )}
      </ul>

      {totalPages > 1 ? (
        <Pagination basePath="/admin/coupons" sp={sp} page={page} totalPages={totalPages} />
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
    if (sp.active) params.set("active", sp.active);
    if (sp.type) params.set("type", sp.type);
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

void TicketX;
export const dynamic = "force-dynamic";
