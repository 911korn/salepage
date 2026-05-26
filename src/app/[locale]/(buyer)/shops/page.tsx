import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShieldCheck, Store } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import type { Metadata } from "next";
import { getDiscoveryFeed, type FeedShop } from "@/lib/feed-shared";
import { KycStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "ร้านค้าทั้งหมด · SalePage",
    description: "ค้นพบร้านค้าจริง ของจริง ส่งตรงจากผู้ขาย ไม่หัก%",
  };
}

interface PageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string; verified?: string }>;
}

export default async function ShopsListPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  // Share the EXACT same query path as /api/v1/feed so mobile + web stay
  // in lockstep. Bumped pageSize to 60 to reduce pagination noise on web
  // — the API default is 20 (mobile uses cursor pagination, web shows a
  // single big grid for now).
  const { shops } = await getDiscoveryFeed({
    category: sp.category,
    verified: sp.verified === "true",
    pageSize: 60,
  });

  return (
    <div className="container-page py-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--color-fg)]">
            ร้านค้าทั้งหมด
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {shops.length === 60
              ? "แสดง 60 ร้านแรก"
              : `ทั้งหมด ${shops.length} ร้าน`}
          </p>
        </div>
        <FilterChips active={sp.verified === "true"} />
      </div>

      {shops.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white p-12 text-center">
          <Store size={36} className="mx-auto text-zinc-400" />
          <p className="mt-3 text-sm text-zinc-500">ยังไม่มีร้านค้าในตัวกรองนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChips({ active }: { active: boolean }) {
  return (
    <div className="flex gap-2">
      <Link
        href="/shops"
        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
          !active
            ? "border-[color:var(--color-brand)]/40 bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]"
            : "border-[color:var(--color-border)] bg-white text-zinc-700"
        }`}
      >
        ทั้งหมด
      </Link>
      <Link
        href="/shops?verified=true"
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${
          active
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-[color:var(--color-border)] bg-white text-zinc-700"
        }`}
      >
        <ShieldCheck size={12} />
        เฉพาะร้านที่ยืนยันตัวตน
      </Link>
    </div>
  );
}

function ShopCard({ shop }: { shop: FeedShop }) {
  const banner = shop.bannerUrls[0];
  const verified = shop.kycStatus === KycStatus.VERIFIED;
  return (
    <Link
      href={`/s/${shop.slug}`}
      className="group overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white transition hover:-translate-y-0.5 hover:border-[color:var(--color-brand)]/30 hover:shadow-md"
    >
      <div
        className="h-28 w-full"
        style={{
          backgroundColor: shop.themeColor,
          backgroundImage: banner ? `url(${banner})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="-mt-7 px-4 pb-4">
        <div
          className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-4 border-white"
          style={{ backgroundColor: shop.themeColor }}
        >
          {shop.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-white">
              {shop.logoText ?? shop.name.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <h3 className="flex-1 truncate text-[15px] font-semibold text-[color:var(--color-fg)]">
            {shop.name}
          </h3>
          {verified ? (
            <ShieldCheck size={14} className="shrink-0 text-emerald-600" />
          ) : null}
        </div>
        {shop.category ? (
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            {shop.category}
          </p>
        ) : null}
        {shop.description ? (
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-zinc-600">
            {shop.description}
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-3 text-[11px] text-zinc-500">
          {shop.totalSold > 0 ? <span>ขายแล้ว {shop.totalSold.toLocaleString()}</span> : null}
          {shop.rating > 0 ? (
            <span>★ {shop.rating.toFixed(1)}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
