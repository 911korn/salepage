import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { CreditCard, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop, dashboardHref } from "@/lib/dashboard-routing";
import { hasBusinessPlan } from "@/lib/plan";
import { PROVIDERS } from "@/lib/payment-gateways/registry";
import { PaymentGatewaysPanel } from "@/components/dashboard/payment-gateways-panel";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/routing";

/**
 * /dashboard/settings/payment-gateways — Business+ only.
 *
 * Two halves: a live grid (Stripe / Omise / Ksher / 2C2P / GBPrimePay)
 * where sellers plug in their keys; and a roadmap grid showing what's
 * coming next so sellers can plan ahead and vote.
 */
export default async function PaymentGatewaysPage({
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

  const live = PROVIDERS.filter((p) => p.availability === "live");
  const roadmap = PROVIDERS.filter((p) => p.availability === "roadmap");

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
          <CreditCard className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Payment Gateways
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-rose-600 to-amber-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
              <Sparkles className="size-3" /> Business+
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            พลัก API key ของ payment gateway ที่คุณมี → ลูกค้าจะมีตัวเลือกจ่ายเพิ่มจาก PromptPay เดิม (เก็บเงินตรงเข้าบัญชีร้านผ่าน gateway นั้น · เราไม่แตะเงินคุณ)
          </p>
        </div>
      </header>

      {isBusinessPlus ? (
        <PaymentGatewaysPanel
          shopSlug={activeShop.slug}
          liveProviders={live}
          roadmapProviders={roadmap}
        />
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
          พลัก gateway ของคุณ
          <br />
          รับบัตรเครดิต / WeChat / Alipay
        </h2>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/90">
          เก็บเงินผ่าน Stripe / Omise / Ksher / 2C2P / GBPrimePay — เงินเข้าบัญชี gateway ของคุณตรง SalePage ไม่หัก%
        </p>
      </div>
      <div className="px-6 py-6">
        <div className="flex items-baseline gap-2">
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
