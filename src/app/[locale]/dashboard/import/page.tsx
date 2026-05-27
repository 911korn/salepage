import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Download } from "lucide-react";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop } from "@/lib/dashboard-routing";
import { ImportPanel } from "@/components/dashboard/import-panel";
import type { Locale } from "@/i18n/routing";

/**
 * /dashboard/import — bulk product importer.
 *
 * Two tabs powered by ImportPanel:
 *  1. Upload CSV/XLSX (Shopee Seller Center export, Lazada export, or
 *     any generic spreadsheet — auto-detected with column mapping the
 *     seller can override before commit).
 *  2. Paste Shopee/Lazada/JSON-LD product URLs — server fetches each
 *     and shows previews; seller edits and commits.
 *
 * Web-only (911korn 2026-05-27 directive). The mobile app keeps its
 * native "add product" flow.
 */
export default async function ImportPage({
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
  if (shops.length === 0) redirect("/dashboard/create-shop");
  const activeShop = resolveDashboardShop(shops, shopParam);
  if (!activeShop) redirect("/dashboard/create-shop");

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
          <Download className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            นำเข้าสินค้า
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            ขายอยู่ที่ Shopee / Lazada / TikTok Shop หรือเว็บอื่น? นำเข้าสินค้าเดิมเข้า {activeShop.name} ในคลิกเดียว
          </p>
        </div>
      </header>

      <ImportPanel shopSlug={activeShop.slug} shopName={activeShop.name} />
    </div>
  );
}
