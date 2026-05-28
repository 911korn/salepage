import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop, dashboardHref } from "@/lib/dashboard-routing";
import {
  HELP_TOPICS,
  getHelpTopic,
} from "@/lib/help-topics";
import { HELP_CONTENT } from "@/components/help/content";
import type { Locale } from "@/i18n/routing";

export async function generateStaticParams() {
  return HELP_TOPICS.map((t) => ({ topic: t.slug }));
}

export default async function HelpTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; topic: string }>;
  searchParams: Promise<{ shop?: string | string[] }>;
}) {
  const { locale, topic: topicSlug } = await params;
  const { shop: shopParam } = await searchParams;
  setRequestLocale(locale);

  const topic = getHelpTopic(topicSlug);
  const Content = HELP_CONTENT[topicSlug];
  if (!topic || !Content) notFound();

  const { shops } = await requireDashboardSession();
  const activeShop = resolveDashboardShop(shops, shopParam);
  const shopSlug = activeShop?.slug;

  // Find prev / next topics for in-flow navigation at the bottom of the page.
  const idx = HELP_TOPICS.findIndex((t) => t.slug === topicSlug);
  const prev = idx > 0 ? HELP_TOPICS[idx - 1] : null;
  const next = idx < HELP_TOPICS.length - 1 ? HELP_TOPICS[idx + 1] : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={dashboardHref("/dashboard/help", shopSlug)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        คู่มือทั้งหมด
      </Link>

      <article className="mt-4">
        <Content />
      </article>

      <nav className="mt-10 grid gap-2 border-t border-zinc-200 pt-6 sm:grid-cols-2">
        {prev ? (
          <Link
            href={dashboardHref(`/dashboard/help/${prev.slug}`, shopSlug)}
            className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 transition hover:border-[color:var(--color-brand-300)]"
          >
            <ChevronRight className="size-4 rotate-180 text-zinc-400 group-hover:text-[color:var(--color-brand-700)]" />
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                ก่อนหน้า
              </p>
              <p className="truncate text-[13px] font-bold text-zinc-900 group-hover:text-[color:var(--color-brand-700)]">
                {prev.title}
              </p>
            </div>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={dashboardHref(`/dashboard/help/${next.slug}`, shopSlug)}
            className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 text-right transition hover:border-[color:var(--color-brand-300)] sm:justify-end"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                ถัดไป
              </p>
              <p className="truncate text-[13px] font-bold text-zinc-900 group-hover:text-[color:var(--color-brand-700)]">
                {next.title}
              </p>
            </div>
            <ChevronRight className="size-4 text-zinc-400 group-hover:text-[color:var(--color-brand-700)]" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
