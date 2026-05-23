import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { ShopActions } from "@/components/admin/shop-actions";
import { db, OrderStatus } from "@/lib/db";
import { storefrontLabel, storefrontPath } from "@/lib/storefront-url";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminShopDetailPage({ params }: Props) {
  const { id } = await params;

  const shop = await db.shop.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, email: true, name: true, role: true },
      },
      _count: {
        select: {
          products: true,
          orders: true,
          reviews: true,
          coupons: true,
          conversations: true,
        },
      },
    },
  });

  if (!shop) notFound();

  const [recentOrders, revenue] = await Promise.all([
    db.order.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        publicToken: true,
        totalSatang: true,
        status: true,
        customerName: true,
        createdAt: true,
      },
    }),
    db.order.aggregate({
      where: {
        shopId: shop.id,
        status: { in: [OrderStatus.PAID, OrderStatus.SHIPPING, OrderStatus.DELIVERED] },
      },
      _sum: { totalSatang: true },
      _count: true,
    }),
  ]);
  const revenueBaht = Math.round((revenue._sum.totalSatang ?? 0) / 100);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/admin/shops"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
      >
        <ArrowLeft className="size-3.5" /> Shops
      </Link>

      <PageHeader
        title={shop.name}
        description={`${storefrontLabel(shop.slug)} · owner ${shop.owner.email}`}
        actions={
          <a
            href={storefrontPath(shop.slug)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <ExternalLink className="size-3.5" /> เปิดหน้าร้าน
          </a>
        }
      />

      {/* Profile + actions */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-start gap-4">
            <span
              className="grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-white"
              style={{ background: shop.themeColor }}
            >
              {shop.logoText ?? shop.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-bold">{shop.name}</p>
              <p className="font-mono text-[12px] text-zinc-500">
                {storefrontLabel(shop.slug)}
              </p>
              {shop.description ? (
                <p className="mt-2 text-sm text-zinc-600">{shop.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Badge tone={shop.status === "ACTIVE" ? "success" : "neutral"}>
                  {shop.status.toLowerCase()}
                </Badge>
                {shop.verified ? <Badge tone="brand">verified</Badge> : null}
                {shop.featured ? <Badge tone="brand">featured</Badge> : null}
                {shop.suspended ? <Badge tone="warning">suspended</Badge> : null}
                {shop.category ? (
                  <Badge tone="neutral">{shop.category}</Badge>
                ) : null}
              </div>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 text-sm sm:grid-cols-4">
            <Stat label="Products" value={shop._count.products} />
            <Stat label="Orders" value={shop._count.orders} />
            <Stat label="Reviews" value={shop._count.reviews} />
            <Stat label="Coupons" value={shop._count.coupons} />
            <Stat label="Chats" value={shop._count.conversations} />
            <Stat label="Rating" value={shop.rating.toFixed(2)} icon={<Star className="inline size-3 text-amber-500" />} />
            <Stat label="Slip credits" value={shop.slipCredits} />
            <Stat label="Revenue" value={`฿${revenueBaht.toLocaleString()}`} />
          </dl>
        </div>

        <ShopActions
          shop={{
            id: shop.id,
            slug: shop.slug,
            suspended: shop.suspended,
            featured: shop.featured,
            verified: shop.verified,
            slipCredits: shop.slipCredits,
            lineWebhookEnabled: shop.lineWebhookEnabled,
          }}
        />
      </section>

      {/* Recent orders */}
      <section className="rounded-2xl border border-zinc-200 bg-white">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="font-display text-base font-semibold">ออเดอร์ล่าสุด</h2>
          <Link
            href={`/admin/orders?shopId=${shop.id}`}
            className="text-[12px] font-medium text-[color:var(--color-brand-700)] hover:underline"
          >
            ดูทั้งหมด →
          </Link>
        </header>
        {recentOrders.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-500">
            ร้านนี้ยังไม่มีออเดอร์
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {o.customerName}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-500">
                    {o.publicToken}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold">
                    ฿{(o.totalSatang / 100).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-zinc-500">{o.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-[11px] text-zinc-400">Shop ID: {shop.id}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-bold tracking-tight">
        {icon} {value}
      </dd>
    </div>
  );
}

export const dynamic = "force-dynamic";
