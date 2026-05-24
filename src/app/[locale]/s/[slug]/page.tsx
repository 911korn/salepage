import { notFound } from "next/navigation";
import { ArrowLeft, Bell, MessageCircle, Phone, ShieldCheck, Star } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { db, PlanKey, ProductStatus } from "@/lib/db";
import { getEffectivePlan } from "@/lib/plan";
import { getShopBySlug as getDemoShop } from "@/lib/demo-data";
import { LogoMark } from "@/components/ui/logo";
import { MaintenancePage } from "@/components/maintenance-page";
import { viewerCanBypassMaintenance, viewerIsAdmin } from "@/lib/admin";
import { getPlatformSetting } from "@/lib/platform-settings";
import { auth } from "@/lib/auth";
import { dashboardHref } from "@/lib/dashboard-routing";
import { storefrontLabel, storefrontPath } from "@/lib/storefront-url";
import type { Locale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ slug: string; locale: Locale }>;
}

interface ProductView {
  slug: string;
  name: string;
  priceBaht: number;
  compareAtBaht: number | null;
  imageUrl: string | null;
  imageBg: string | null;
  badge: "HOT" | "NEW" | "SALE" | null;
  type: "physical" | "digital";
  sold: number;
}

interface ShopView {
  slug: string;
  name: string;
  description: string;
  logoText: string;
  logoUrl: string | null;
  category: string;
  themeColor: string;
  verified: boolean;
  rating: number;
  totalSold: number;
  bannerBg: string;
  bannerUrl: string | null;
  announcement: string | null;
  contact: {
    phone?: string | null;
    line?: string | null;
    facebook?: string | null;
  };
  products: ProductView[];
}

const DEFAULT_BANNER =
  "linear-gradient(135deg,#fff1f2 0%,#fecdd3 50%,#fda4af 100%)";

export default async function StorefrontPage({ params }: PageProps) {
  const { slug, locale } = await params;
  setRequestLocale(locale);

  // Platform-wide maintenance mode short-circuits the storefront. Admins
  // (USER role listed in allowedRoles, or ADMIN/SUPER_ADMIN failsafe) keep
  // browsing so they can validate the fix before unlocking.
  const maintenance = await getPlatformSetting("maintenance_mode");
  if (maintenance.enabled) {
    const canBypass = await viewerCanBypassMaintenance(maintenance.allowedRoles);
    if (!canBypass) {
      return (
        <MaintenancePage
          message={maintenance.message}
          viewerIsAdmin={false}
        />
      );
    }
  }

  const dbShop = await db.shop.findUnique({
    where: { slug },
    include: {
      products: {
        where: { status: { not: ProductStatus.HIDDEN } },
        orderBy: [{ sold: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  // Admin-suspended shops disappear from public view. Owner can see why in
  // /dashboard banner (TODO) and reach out to support.
  if (dbShop?.suspended) {
    notFound();
  }

  // Silence unused-imports for symbols only used inside the bypass branch.
  void viewerIsAdmin;

  // Watermark shows for FREE-tier shops only. Demo shops + paid tiers hide it.
  // Per pricing copy: "มีโลโก้ SalePage บนหน้าเว็บ" (Free) → "ไม่มีโลโก้" (paid).
  const ownerPlan = dbShop ? await getEffectivePlan(dbShop.ownerId) : null;
  const showWatermark = ownerPlan === PlanKey.FREE;

  const dbReviews = dbShop
    ? await db.review.findMany({
        where: { shopId: dbShop.id },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          rating: true,
          comment: true,
          customerName: true,
          reply: true,
          createdAt: true,
        },
      })
    : [];

  let view: ShopView | null = null;

  if (dbShop && dbShop.status === "ACTIVE") {
    view = {
      slug: dbShop.slug,
      name: dbShop.name,
      description: dbShop.description ?? "",
      logoText: dbShop.logoText ?? dbShop.name.slice(0, 1).toUpperCase(),
      logoUrl: dbShop.logoUrl,
      category: dbShop.category ?? "",
      themeColor: dbShop.themeColor,
      verified: dbShop.verified,
      rating: dbShop.rating ?? 0,
      totalSold: dbShop.totalSold ?? 0,
      bannerBg: DEFAULT_BANNER,
      bannerUrl: dbShop.bannerUrls?.[0] ?? null,
      announcement: dbShop.announcement?.trim() || null,
      contact: (dbShop.contact as ShopView["contact"] | null) ?? {},
      products: dbShop.products.map((p) => ({
        slug: p.slug,
        name: p.name,
        priceBaht: Math.round(p.priceSatang / 100),
        compareAtBaht: p.compareAtSatang
          ? Math.round(p.compareAtSatang / 100)
          : null,
        imageUrl: p.imageUrls?.[0] ?? null,
        imageBg: null,
        badge: p.badge,
        type: p.type === "DIGITAL" ? "digital" : "physical",
        sold: p.sold,
      })),
    };
  }

  if (!view) {
    const demo = getDemoShop(slug);
    if (demo) {
      view = {
        slug: demo.slug,
        name: demo.name,
        description: demo.description,
        logoText: demo.logo,
        logoUrl: null,
        category: demo.category,
        themeColor: demo.themeColor,
        verified: demo.verified,
        rating: demo.rating,
        totalSold: demo.totalSold,
        bannerBg: demo.banners[0] ?? DEFAULT_BANNER,
        bannerUrl: null,
        announcement: null,
        contact: demo.contact ?? {},
        products: demo.products.map((p) => ({
          slug: p.slug,
          name: p.name,
          priceBaht: p.price,
          compareAtBaht: p.compareAt ?? null,
          imageUrl: null,
          imageBg: p.image,
          badge: p.badge ?? null,
          type: p.type,
          sold: p.sold,
        })),
      };
    }
  }

  if (!view) notFound();

  const t = await getTranslations("shop");
  const tCommon = await getTranslations("common");
  const session = await auth();
  const shop = view;
  const ownerDashboardHref =
    dbShop && session?.user?.id === dbShop.ownerId
      ? dashboardHref("/dashboard", dbShop.slug)
      : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[color:var(--color-soft)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-white/85 backdrop-blur-xl">
        <div className="container-page flex h-14 min-w-0 items-center gap-2">
          <Link
            href={ownerDashboardHref ?? "/"}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-[color:var(--color-fg)]"
          >
            <ArrowLeft className="size-4" /> {t("back")}
          </Link>
          <p className="min-w-0 flex-1 truncate text-center font-mono text-xs text-zinc-500">
            {storefrontLabel(shop.slug)}
          </p>
          <Link
            href={ownerDashboardHref ?? "/signup"}
            className={cn(buttonStyles({
              size: "sm",
              className: "shrink-0 px-2.5 text-xs sm:px-3.5 sm:text-sm",
            }))}
          >
            {ownerDashboardHref ? (
              <>
                <span className="sm:hidden">
                  {locale === "th" ? "จัดการร้าน" : "Manage"}
                </span>
                <span className="hidden sm:inline">
                  {locale === "th" ? "จัดการร้าน" : tCommon("dashboard")}
                </span>
              </>
            ) : (
              <>
                <span className="sm:hidden">สร้างร้าน</span>
                <span className="hidden sm:inline">{t("createOwn")}</span>
              </>
            )}
          </Link>
        </div>
      </header>

      <div className="relative">
        <div
          className="h-44 sm:h-56"
          style={
            shop.bannerUrl
              ? {
                  backgroundImage: `url(${shop.bannerUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : { background: shop.bannerBg }
          }
        />
        <div className="container-page -mt-16 sm:-mt-20">
          {shop.announcement ? (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[color:var(--color-brand-100)] bg-[color:var(--color-brand-50)] px-4 py-3 text-[13px] text-[color:var(--color-brand-800)] sm:text-[14px]">
              <Bell className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand-600)]" />
              <p className="leading-relaxed">{shop.announcement}</p>
            </div>
          ) : null}
          <div className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div
                  className="grid size-20 place-items-center overflow-hidden rounded-2xl border-4 border-white font-display text-3xl font-bold text-white shadow-lg sm:size-24 sm:text-4xl"
                  style={{ background: shop.themeColor }}
                >
                  {shop.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shop.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    shop.logoText
                  )}
                </div>
                <div className="pb-1">
                  <div className="flex items-center gap-1.5">
                    <h1 className="font-display text-2xl font-bold sm:text-3xl">
                      {shop.name}
                    </h1>
                    {shop.verified ? (
                      <ShieldCheck className="size-5 text-[color:var(--color-brand-600)]" />
                    ) : null}
                  </div>
                  {shop.category ? (
                    <p className="mt-1 text-sm text-zinc-600">{shop.category}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">{tCommon("open")}</Badge>
                {shop.rating > 0 ? (
                  <Badge tone="soft-brand">
                    <Star className="size-3 fill-current" /> {shop.rating}
                  </Badge>
                ) : null}
                {shop.totalSold > 0 ? (
                  <Badge tone="neutral">
                    {t("sold")} {shop.totalSold.toLocaleString()}+
                  </Badge>
                ) : null}
              </div>
            </div>

            {shop.description ? (
              <p className="mt-5 text-[15px] leading-relaxed text-zinc-700">
                {shop.description}
              </p>
            ) : null}

            <ContactButtons contact={shop.contact} />


            <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-[color:var(--color-soft)] p-3 sm:grid-cols-3">
              <Stat label={t("products")} value={String(shop.products.length)} />
              <Stat
                label={t("rating")}
                value={shop.rating > 0 ? `${shop.rating} / 5` : "—"}
              />
              <Stat
                label={t("sold")}
                value={
                  shop.totalSold > 0
                    ? `${shop.totalSold.toLocaleString()}+`
                    : "—"
                }
                className="col-span-2 sm:col-span-1"
              />
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-bold sm:text-2xl">
                {t("allProducts")}
              </h2>
              <span className="text-sm text-zinc-500">
                {shop.products.length} {t("items")}
              </span>
            </div>

            {shop.products.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white px-6 py-14 text-center">
                <p className="font-display text-base font-semibold">
                  {t("emptyTitle")}
                </p>
                <p className="mt-1.5 text-[13px] text-zinc-500">
                  {t("emptyDesc")}
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {shop.products.map((p) => (
                  <Link
                    key={p.slug}
                    href={storefrontPath(shop.slug, p.slug)}
                    className="group block overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-lg hover:shadow-rose-100/60"
                  >
                    <div
                      className="relative aspect-square w-full"
                      style={
                        p.imageUrl
                          ? {
                              backgroundImage: `url(${p.imageUrl})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : {
                              background:
                                p.imageBg ??
                                "linear-gradient(135deg,var(--color-brand-100),var(--color-brand-300))",
                            }
                      }
                    >
                      {p.compareAtBaht ? (
                        <span className="absolute left-2 top-2 rounded-md bg-black/80 px-2 py-1 text-[10px] font-bold text-white">
                          -{Math.round(((p.compareAtBaht - p.priceBaht) / p.compareAtBaht) * 100)}%
                        </span>
                      ) : null}
                      {p.badge ? (
                        <span
                          className={cn(
                            "absolute right-2 top-2 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white",
                            p.badge === "HOT" && "bg-orange-500",
                            p.badge === "NEW" && "bg-emerald-500",
                            p.badge === "SALE" && "bg-[color:var(--color-brand-600)]",
                          )}
                        >
                          {p.badge === "HOT" ? t("badgeHot") : p.badge === "NEW" ? t("badgeNew") : t("badgeSale")}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-3 sm:p-4">
                      <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-medium text-zinc-800 sm:text-[14px]">
                        {p.name}
                      </p>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-[color:var(--color-brand-700)]">
                          ฿{p.priceBaht.toLocaleString()}
                        </span>
                        {p.compareAtBaht ? (
                          <span className="text-[11px] text-zinc-400 line-through">
                            ฿{p.compareAtBaht.toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                        <span
                          className={cn(
                            "rounded-full border px-1.5 py-0.5",
                            p.type === "digital"
                              ? "border-violet-200 bg-violet-50 text-violet-700"
                              : "border-zinc-200 bg-zinc-50",
                          )}
                        >
                          {p.type === "digital" ? t("digital") : t("physical")}
                        </span>
                        <span>{t("soldCount", { n: p.sold.toLocaleString() })}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {dbReviews.length > 0 ? (
            <div className="mt-10">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold sm:text-2xl">
                  รีวิวล่าสุด
                </h2>
                <span className="text-sm text-zinc-500">
                  {dbReviews.length} รีวิวล่าสุด
                </span>
              </div>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {dbReviews.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {r.customerName}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "size-3.5",
                              i < r.rating
                                ? "fill-amber-400 text-amber-400"
                                : "fill-zinc-200 text-zinc-200",
                            )}
                          />
                        ))}
                      </span>
                    </div>
                    {r.comment ? (
                      <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-zinc-700">
                        {r.comment}
                      </p>
                    ) : null}
                    {r.reply ? (
                      <p className="mt-2 rounded-lg bg-[color:var(--color-soft)] px-2.5 py-1.5 text-[12px] text-zinc-700">
                        <span className="font-semibold text-[color:var(--color-brand-700)]">
                          ร้านตอบ:
                        </span>{" "}
                        {r.reply}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <footer className="mt-16 pb-10">
            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white p-5 text-center">
              <p className="text-sm text-zinc-600">
                ร้านนี้ใช้แพลตฟอร์ม{" "}
                <Link
                  href="/"
                  className="font-semibold text-[color:var(--color-brand-700)] hover:underline"
                >
                  SalePage
                </Link>
                {" "}— สร้างร้านของคุณฟรี ใช้เวลา 30 วินาที
              </p>
            </div>
          </footer>
        </div>
      </div>

      {showWatermark ? (
        <Link
          href="/"
          aria-label="Powered by SalePage"
          className="group fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-white/95 px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-lg backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-brand-300)] hover:text-[color:var(--color-brand-700)]"
        >
          <LogoMark className="size-4" />
          <span>
            สร้างด้วย{" "}
            <span className="font-semibold text-[color:var(--color-brand-700)]">
              SalePage
            </span>
          </span>
        </Link>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white px-3 py-2.5 text-center ring-1 ring-[color:var(--color-border)]",
        className,
      )}
    >
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function ContactButtons({
  contact,
}: {
  contact: { phone?: string | null; line?: string | null; facebook?: string | null };
}) {
  const phone = contact.phone?.trim();
  const line = contact.line?.trim();
  const facebook = contact.facebook?.trim();
  if (!phone && !line && !facebook) return null;

  const lineUrl = line
    ? line.startsWith("http")
      ? line
      : `https://line.me/R/ti/p/${line.startsWith("@") ? "%40" + line.slice(1) : line}`
    : null;
  const facebookUrl = facebook
    ? facebook.startsWith("http")
      ? facebook
      : `https://m.me/${facebook.replace(/^@/, "")}`
    : null;
  const phoneNumber = phone?.replace(/[^\d+]/g, "");

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {lineUrl ? (
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[13px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <MessageCircle className="size-4" /> แชท LINE
        </a>
      ) : null}
      {phoneNumber ? (
        <a
          href={`tel:${phoneNumber}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-zinc-800 transition-colors hover:bg-[color:var(--color-soft)]"
        >
          <Phone className="size-4" /> โทร {phone}
        </a>
      ) : null}
      {facebookUrl ? (
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-[13px] font-semibold text-blue-700 transition-colors hover:bg-blue-100"
        >
          <MessageCircle className="size-4" /> Messenger
        </a>
      ) : null}
    </div>
  );
}
