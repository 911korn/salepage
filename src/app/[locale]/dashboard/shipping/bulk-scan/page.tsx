import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Package2, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop, dashboardHref } from "@/lib/dashboard-routing";
import { hasBusinessPlan } from "@/lib/plan";
import { BulkScanPanel } from "@/components/dashboard/bulk-scan-panel";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
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
 * Gated to Business+ — same tier as single-order Auto Tracking. 911korn
 * 2026-05-28 "เคสที่ Seller ส่งเยอะๆ ... 1 วัน ส่ง 100 Order มันควรที่
 * จะฉลาดพอในการอ่านทั้งหมดแล้วนำไป Update".
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

  const { user, shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");
  const activeShop = resolveDashboardShop(shops, shopParam);
  if (!activeShop) redirect("/dashboard/create-shop");

  const isBusinessPlus = await hasBusinessPlan(user.id);

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
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-rose-600 to-amber-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
              <Sparkles className="size-3" /> Business+
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            ถ่ายรูปใบเสร็จขนส่งทั้งกอง · AI อ่านทุกใบ จับคู่กับออเดอร์ที่จ่ายแล้วให้ทันที — เฉพาะที่ AI ไม่มั่นใจถึงจะให้คุณกดยืนยันเอง
          </p>
        </div>
      </header>

      {isBusinessPlus ? (
        <BulkScanPanel shopSlug={activeShop.slug} />
      ) : (
        <UpgradeNotice />
      )}
    </div>
  );
}

function UpgradeNotice() {
  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white">
      <div className="bg-gradient-to-br from-rose-600 via-rose-500 to-amber-500 px-6 py-8 text-white">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
          <Sparkles className="size-3.5" /> Business+ Feature
        </span>
        <h2 className="font-display mt-3 text-2xl font-bold leading-tight">
          ส่ง 100 ออเดอร์/วัน
          <br />
          ก็ไม่ต้องพิมพ์ tracking เอง
        </h2>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/90">
          ถ่ายรูปใบเสร็จเป็นกอง · AI อ่านทุกใบ จับคู่กับลูกค้าให้ทันที · พ่อค้าตรวจเฉพาะที่ AI ไม่มั่นใจ
        </p>
      </div>
      <div className="px-6 py-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Bullet text="อัปได้สูงสุด 20 รูปต่อรอบ (~100 ใบเสร็จ)" />
          <Bullet text="AI จับคู่ชื่อ + รหัสไปรษณีย์ + เบอร์โทรอัตโนมัติ" />
          <Bullet text="Crop เฉพาะใบที่สงสัยส่งให้ดูเอง" />
          <Bullet text="กดยืนยันครั้งเดียวอัปเดต tracking ครบทั้งกอง" />
        </div>
        <div className="mt-6 flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold text-zinc-900">
            ฿790
          </span>
          <span className="text-sm text-zinc-500">/ เดือน — แผน Business</span>
        </div>
        <Link
          href={dashboardHref("/", undefined) + "#pricing"}
          className={cn(buttonStyles({ size: "lg" }), "mt-4 w-full sm:w-auto")}
        >
          อัปเกรดเป็น Business
        </Link>
      </div>
    </section>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-[13px] text-zinc-700">
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
        ✓
      </span>
      <span>{text}</span>
    </div>
  );
}
