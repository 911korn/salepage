import { setRequestLocale } from "next-intl/server";
import {
  AlertCircle,
  BadgePercent,
  BookOpen,
  ChartBar,
  Download,
  Globe,
  MessageCircle,
  Package,
  Package2,
  ReceiptText,
  Rocket,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop, dashboardHref } from "@/lib/dashboard-routing";
import {
  HELP_TOPICS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type HelpTopic,
} from "@/lib/help-topics";
import type { Locale } from "@/i18n/routing";

const ICONS: Record<HelpTopic["icon"], LucideIcon> = {
  Rocket,
  Settings,
  ShoppingBag,
  Download,
  Package,
  Truck,
  Package2,
  Wallet,
  ReceiptText,
  Ticket,
  MessageCircle,
  ShieldCheck,
  BadgePercent,
  AlertCircle,
  ChartBar,
  Globe,
};

export default async function HelpIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ shop?: string | string[] }>;
}) {
  const { locale } = await params;
  const { shop: shopParam } = await searchParams;
  setRequestLocale(locale);

  const { shops } = await requireDashboardSession();
  const activeShop = resolveDashboardShop(shops, shopParam);
  const shopSlug = activeShop?.slug;

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    topics: HELP_TOPICS.filter((t) => t.category === category),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
          <BookOpen className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            คู่มือใช้งาน SalePage
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            ทุกขั้นตอนแบบทำตามได้จริง · ภาพประกอบทุกหน้า · เขียนสำหรับคนที่เปิดร้านออนไลน์ครั้งแรก
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-10">
        {grouped.map((g) => (
          <section key={g.category}>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-zinc-500">
              {g.label}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.topics.map((t) => {
                const Icon = ICONS[t.icon];
                return (
                  <Link
                    key={t.slug}
                    href={dashboardHref(
                      `/dashboard/help/${t.slug}`,
                      shopSlug,
                    )}
                    className="group flex items-start gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white p-4 transition hover:border-[color:var(--color-brand-300)] hover:shadow-md"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] transition group-hover:bg-[color:var(--color-brand-100)]">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-[15px] font-bold leading-tight text-zinc-900 group-hover:text-[color:var(--color-brand-700)]">
                        {t.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-zinc-500">
                        {t.teaser}
                      </p>
                      <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                        อ่าน {t.minutes} นาที
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-center">
        <p className="text-[13px] text-zinc-600">
          ติดอยู่ที่ไหน หรืออยากให้เพิ่มหัวข้อ? แชทกับเราที่{" "}
          <a
            href="https://line.me/R/ti/p/%40salepage"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[color:var(--color-brand-700)] underline"
          >
            LINE @salepage
          </a>
        </p>
      </footer>
    </div>
  );
}
