import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShieldCheck, Store, Shirt, UtensilsCrossed, Smartphone, Sparkles, HeartPulse, Sofa, PawPrint, Book, Dumbbell, Box, Check } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import type { Metadata } from "next";
import { getProductsFeed, type FeedSort } from "@/lib/products-feed-shared";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "ร้านค้าทั้งหมด · SalePage",
    description: "ของจริง ราคาดี ส่งตรงจากร้าน — ไม่หัก%",
  };
}

const CATEGORY_KEYS = [
  "fashion",
  "food",
  "tech",
  "beauty",
  "health",
  "furniture",
  "pets",
  "books",
  "sport",
  "other",
] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const CATEGORY_ICONS: Record<CategoryKey, typeof Shirt> = {
  fashion: Shirt,
  food: UtensilsCrossed,
  tech: Smartphone,
  beauty: Sparkles,
  health: HeartPulse,
  furniture: Sofa,
  pets: PawPrint,
  books: Book,
  sport: Dumbbell,
  other: Box,
};

const SORT_TABS: Array<{ key: FeedSort; label: string }> = [
  { key: "relevance", label: "แนะนำ" },
  { key: "sold", label: "ขายดี" },
  { key: "newest", label: "ใหม่" },
];

interface PageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{
    sort?: string;
    category?: string;
    verified?: string;
    /** `pre_owned` to show only second-hand listings. */
    condition?: string;
  }>;
}

export default async function ShopsListPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tCats = await getTranslations("categories");

  const sort = (SORT_TABS.find((t) => t.key === sp.sort)?.key ?? "relevance") as FeedSort;
  // Category filter — `getProductsFeed` matches Product.category strings
  // (the platform 10-key set). Mobile stores the same key strings (not
  // the localized label), so we pass the raw key through.
  const categoryKey = sp.category && CATEGORY_KEYS.includes(sp.category as CategoryKey)
    ? (sp.category as CategoryKey)
    : undefined;
  const verified = sp.verified === "true";
  const preOwnedOnly = sp.condition === "pre_owned";

  const { products } = await getProductsFeed({
    sort,
    category: categoryKey,
    verified,
    condition: preOwnedOnly ? "PRE_OWNED" : undefined,
    pageSize: 40,
  });

  return (
    <div className="container-page py-6">
      {/* Header — wordmark + tagline mirrors the mobile Home tab so the
          marketplace surface reads the same on both platforms. */}
      <div className="mb-4">
        <p className="text-xs text-zinc-500">
          ของจริง ราคาดี ส่งตรงจากร้าน — ไม่หัก%
        </p>
      </div>

      {/* Sort + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SORT_TABS.map((tab) => {
          const params = new URLSearchParams();
          if (tab.key !== "relevance") params.set("sort", tab.key);
          if (sp.category) params.set("category", sp.category);
          if (sp.verified === "true") params.set("verified", "true");
          if (preOwnedOnly) params.set("condition", "pre_owned");
          const href = params.toString() ? `/shops?${params.toString()}` : "/shops";
          const isActive = sort === tab.key;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                isActive
                  ? "bg-[color:var(--color-brand)] text-white"
                  : "border border-[color:var(--color-border)] bg-white text-zinc-700 hover:border-[color:var(--color-brand)]/30"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        <PreOwnedToggle
          active={preOwnedOnly}
          sort={sort}
          category={sp.category}
          verified={verified}
        />
        <VerifiedToggle
          active={verified}
          sort={sort}
          category={sp.category}
          preOwnedOnly={preOwnedOnly}
        />
      </div>

      {/* Category chips */}
      <div className="-mx-2 mb-6 flex gap-2 overflow-x-auto px-2 pb-2">
        <CategoryChip
          label="ทั้งหมด"
          icon={<Store size={20} />}
          href={buildHref({ sort, verified, preOwnedOnly })}
          isActive={!sp.category}
        />
        {CATEGORY_KEYS.map((key) => {
          const Icon = CATEGORY_ICONS[key];
          return (
            <CategoryChip
              key={key}
              label={tCats(key)}
              icon={<Icon size={20} />}
              href={buildHref({ sort, verified, preOwnedOnly, category: key })}
              isActive={sp.category === key}
            />
          );
        })}
      </div>

      {/* Product grid */}
      {products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white p-12 text-center">
          <Store size={36} className="mx-auto text-zinc-400" />
          <p className="mt-3 text-sm text-zinc-500">ยังไม่มีสินค้าในตัวกรองนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <p className="text-xs text-zinc-500">
          แสดง {products.length} สินค้าแรก — สนใจเลื่อนไปยังร้านแบบเต็มหน้าได้ที่{" "}
          <Link href="/" className="text-[color:var(--color-brand)] underline">
            หน้าแรก
          </Link>
        </p>
      </div>
    </div>
  );
}

function buildHref({
  sort,
  verified,
  category,
  preOwnedOnly,
}: {
  sort: FeedSort;
  verified: boolean;
  category?: string;
  preOwnedOnly?: boolean;
}) {
  const params = new URLSearchParams();
  if (sort !== "relevance") params.set("sort", sort);
  if (verified) params.set("verified", "true");
  if (category) params.set("category", category);
  if (preOwnedOnly) params.set("condition", "pre_owned");
  return params.toString() ? `/shops?${params.toString()}` : "/shops";
}

function VerifiedToggle({
  active,
  sort,
  category,
  preOwnedOnly,
}: {
  active: boolean;
  sort: FeedSort;
  category?: string;
  preOwnedOnly: boolean;
}) {
  const params = new URLSearchParams();
  if (sort !== "relevance") params.set("sort", sort);
  if (category) params.set("category", category);
  if (preOwnedOnly) params.set("condition", "pre_owned");
  if (!active) params.set("verified", "true");
  const href = params.toString() ? `/shops?${params.toString()}` : "/shops";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${
        active
          ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border border-[color:var(--color-border)] bg-white text-zinc-700"
      }`}
    >
      {active ? <Check size={12} /> : <ShieldCheck size={12} />}
      ยืนยันแล้ว
    </Link>
  );
}

/**
 * Pre-owned only filter — the marketplace differentiator 911korn called
 * out 2026-05-27 ("tag สินค้ามือสอง อันนี้น่าจะมีประโยชน์มาก ทำให้แอพ
 * ดูมีจุดเด่นขึ้นมาเลย"). Standalone toggle so a buyer can flip into
 * mode "show me only second-hand" with one tap.
 */
function PreOwnedToggle({
  active,
  sort,
  category,
  verified,
}: {
  active: boolean;
  sort: FeedSort;
  category?: string;
  verified: boolean;
}) {
  const params = new URLSearchParams();
  if (sort !== "relevance") params.set("sort", sort);
  if (category) params.set("category", category);
  if (verified) params.set("verified", "true");
  if (!active) params.set("condition", "pre_owned");
  const href = params.toString() ? `/shops?${params.toString()}` : "/shops";
  return (
    <Link
      href={href}
      className={`ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${
        active
          ? "border border-amber-300 bg-amber-50 text-amber-800"
          : "border border-[color:var(--color-border)] bg-white text-zinc-700"
      }`}
    >
      ♻️ มือสอง
    </Link>
  );
}

function CategoryChip({
  label,
  icon,
  href,
  isActive,
}: {
  label: string;
  icon: React.ReactNode;
  href: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 flex-col items-center justify-center rounded-2xl border px-4 py-2.5 text-xs ${
        isActive
          ? "border-[color:var(--color-brand)]/40 bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]"
          : "border-[color:var(--color-border)] bg-white text-zinc-700 hover:border-[color:var(--color-brand)]/30"
      }`}
    >
      <span className={isActive ? "" : "text-zinc-700"}>{icon}</span>
      <span className="mt-1 whitespace-nowrap text-[11px] font-medium">{label}</span>
    </Link>
  );
}

interface ProductCardProps {
  product: {
    id: string;
    slug: string;
    shopSlug: string;
    shopName: string;
    name: string;
    priceSatang: number;
    compareAtSatang: number | null;
    imageUrl: string | null;
    badge: string | null;
    sold: number;
    shopRating: number;
    category: string | null;
    condition: "NEW" | "PRE_OWNED";
  };
}

const CATEGORY_LABELS_INLINE: Record<string, string> = {
  fashion: "แฟชั่น",
  food: "อาหาร",
  tech: "ไอที",
  beauty: "ความงาม",
  health: "สุขภาพ",
  furniture: "เฟอร์นิเจอร์",
  pets: "สัตว์เลี้ยง",
  books: "หนังสือ",
  sport: "กีฬา",
  other: "อื่นๆ",
};

function ProductCard({ product }: ProductCardProps) {
  const discountPct =
    product.compareAtSatang && product.compareAtSatang > product.priceSatang
      ? Math.round(
          ((product.compareAtSatang - product.priceSatang) / product.compareAtSatang) * 100,
        )
      : 0;
  const isPreOwned = product.condition === "PRE_OWNED";
  const categoryLabel = product.category
    ? CATEGORY_LABELS_INLINE[product.category] ?? null
    : null;
  return (
    <Link
      href={`/s/${product.shopSlug}/${product.slug}`}
      className={`group overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-0.5 hover:shadow-md ${
        isPreOwned
          ? "border-amber-300/70 ring-1 ring-amber-100"
          : "border-[color:var(--color-border)]"
      }`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[color:var(--color-soft)]">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : null}
        {/* Left stack — discount + product badge */}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {product.badge ? (
            <span className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {product.badge.toUpperCase()}
            </span>
          ) : null}
          {discountPct > 0 ? (
            <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              -{discountPct}%
            </span>
          ) : null}
        </div>
        {/* Right stack — condition pin. PRE_OWNED is the differentiator
            we promote (911korn 2026-05-27: "tag สินค้ามือสอง อันนี้น่าจะ
            มีประโยชน์มาก ทำให้แอพดูมีจุดเด่นขึ้นมาเลย"). NEW shows nothing
            so we don't pollute every card. */}
        {isPreOwned ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            ♻️ มือสอง
          </span>
        ) : null}
      </div>
      <div className="p-3">
        {categoryLabel ? (
          <span className="mb-1 inline-block rounded-full bg-[color:var(--color-soft)] px-2 py-0.5 text-[10px] font-medium text-zinc-600">
            {categoryLabel}
          </span>
        ) : null}
        <p className="line-clamp-2 min-h-[2.5rem] text-[13px] leading-tight text-[color:var(--color-fg)]">
          {product.name}
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-base font-bold text-[color:var(--color-brand)]">
            ฿{(product.priceSatang / 100).toLocaleString()}
          </span>
          {product.compareAtSatang && product.compareAtSatang > product.priceSatang ? (
            <span className="text-xs text-zinc-400 line-through">
              ฿{(product.compareAtSatang / 100).toLocaleString()}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-[11px] text-zinc-500">
          {product.shopName}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
          {product.shopRating > 0 ? <span>★ {product.shopRating.toFixed(1)}</span> : null}
          {product.sold > 0 ? <span>ขายแล้ว {product.sold}</span> : null}
        </div>
      </div>
    </Link>
  );
}
