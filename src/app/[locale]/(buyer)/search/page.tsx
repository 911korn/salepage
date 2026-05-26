import { setRequestLocale } from "next-intl/server";
import { Search, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { headers } from "next/headers";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

interface SearchResult {
  shops: Array<{
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    logoText: string | null;
    themeColor: string;
    kycStatus: string;
    trustScore: number;
    rating: number;
    totalSold: number;
  }>;
  products: Array<{
    slug: string;
    shopSlug: string;
    shopName: string;
    name: string;
    priceSatang: number;
    imageUrl: string | null;
  }>;
}

interface PageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const q = sp.q?.trim() ?? "";

  // Hit the same `/api/v1/search` endpoint mobile uses, server-side, so
  // the search algorithm stays in one place (911korn 2026-05-27 "ใช้ api
  // อันเดียวกันนะ"). We resolve the origin from the inbound headers so
  // this works on both prod and preview deployments.
  let result: SearchResult | null = null;
  if (q) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "salepage.in.th";
    const proto = h.get("x-forwarded-proto") ?? "https";
    const url = `${proto}://${host}/api/v1/search?q=${encodeURIComponent(q)}`;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: { cookie: h.get("cookie") ?? "" },
      });
      const json = (await res.json()) as { ok: boolean; data?: SearchResult };
      if (json.ok && json.data) result = json.data;
    } catch {
      /* shown as no-results */
    }
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold">ค้นหา</h1>
      <SearchBox initial={q} />

      {!q ? (
        <p className="mt-6 text-sm text-zinc-500">
          พิมพ์ชื่อสินค้าหรือร้านในกล่องด้านบนเพื่อค้นหา
        </p>
      ) : !result ? (
        <p className="mt-6 text-sm text-zinc-500">ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง</p>
      ) : (
        <>
          {result.shops.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                ร้านค้า ({result.shops.length})
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.shops.map((shop) => (
                  <Link
                    key={shop.id}
                    href={`/s/${shop.slug}`}
                    className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white p-3 hover:border-[color:var(--color-brand)]/30"
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl"
                      style={{ backgroundColor: shop.themeColor }}
                    >
                      {shop.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={shop.logoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-white">
                          {shop.logoText ?? shop.name.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">
                          {shop.name}
                        </span>
                        {shop.kycStatus === "VERIFIED" ? (
                          <ShieldCheck size={12} className="shrink-0 text-emerald-600" />
                        ) : null}
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        ขายแล้ว {shop.totalSold.toLocaleString()}
                        {shop.rating > 0 ? ` · ★ ${shop.rating.toFixed(1)}` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {result.products.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                สินค้า ({result.products.length})
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {result.products.map((p) => (
                  <Link
                    key={`${p.shopSlug}/${p.slug}`}
                    href={`/s/${p.shopSlug}/${p.slug}`}
                    className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-brand)]/30"
                  >
                    <div className="aspect-square w-full bg-[color:var(--color-soft)]">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm">{p.name}</p>
                      <p className="mt-1 text-sm font-bold text-[color:var(--color-brand)]">
                        ฿{(p.priceSatang / 100).toLocaleString()}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                        {p.shopName}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {result.shops.length === 0 && result.products.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white p-10 text-center">
              <Search size={32} className="mx-auto text-zinc-400" />
              <p className="mt-3 text-sm text-zinc-500">
                ไม่พบผลการค้นหาสำหรับ &quot;{q}&quot;
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function SearchBox({ initial }: { initial: string }) {
  return (
    <form action="/search" method="get" className="mt-4 flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white px-4 py-2.5">
      <Search size={16} className="text-zinc-400" />
      <input
        name="q"
        defaultValue={initial}
        placeholder="ค้นหาสินค้าหรือร้าน"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
        autoFocus
      />
    </form>
  );
}
