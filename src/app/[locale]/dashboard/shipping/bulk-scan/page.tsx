import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Package2, Sparkles } from "lucide-react";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop } from "@/lib/dashboard-routing";
import { BulkScanPanel } from "@/components/dashboard/bulk-scan-panel";
import type { Locale } from "@/i18n/routing";

/**
 * /dashboard/shipping/bulk-scan — AI Bulk Tracking (Phase 1 MVP).
 *
 * Seller photographs a stack of courier drop-off receipts (multi-photo,
 * up to 20 photos per batch, ~5 receipts per photo recommended for
 * clarity). Claude Sonnet vision pulls every {trackingNumber,
 * receiverName, postcode} per photo, the matcher scores each against
 * the shop's PAID-with-no-tracking orders, and the seller reviews +
 * applies the batch in one go.
 *
 * Free for every tier (911korn 2026-05-29 "ระบบใบปะหน้า ปล่อย Free ก่อน
 * เลย ให้คนใช้เยอะๆ ค่อยแก้อีกที"). Reverts the brief Business+ gate added
 * 2026-05-28 so the AI Bulk Tracking flow is back to its design intent
 * (per shipping-loop memory): the platform's marketing edge, free for
 * every seller.
 */
export default async function BulkScanPage({
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
    <div className="mx-auto max-w-5xl">
      <header className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
          <Package2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              AI Bulk Tracking
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              <Sparkles className="size-3" /> Free
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            ถ่ายรูปใบเสร็จขนส่งทั้งกอง · AI อ่านทุกใบ จับคู่กับออเดอร์ที่จ่ายแล้วให้ทันที — เฉพาะที่ AI ไม่มั่นใจถึงจะให้คุณกดยืนยันเอง
          </p>
        </div>
      </header>

      <BulkScanPanel shopSlug={activeShop.slug} />
    </div>
  );
}
