import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Globe, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop, dashboardHref } from "@/lib/dashboard-routing";
import { hasProPlan } from "@/lib/plan";
import { DomainsPanel } from "@/components/dashboard/domains-panel";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/routing";

/**
 * /dashboard/settings/domains — Pro+ only.
 *
 * Seller goes to a registrar (any one — they keep ownership of the
 * domain), buys their name, then comes back here. We provision a CF
 * zone under our account, give them the 2 nameservers, and they paste
 * those at the registrar. Once DNS propagates, the shop is reachable
 * at the custom domain with SSL via CF + Vercel.
 */
export default async function DomainsPage({
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
  const isProPlus = await hasProPlan(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
          <Globe className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Custom Domain
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-rose-600 to-amber-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
              <Sparkles className="size-3" /> Pro+
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            ใช้โดเมนของคุณเอง — เช่น <strong>mystore.com</strong> — แทนลิงก์{" "}
            <strong>salepage.in.th/s/...</strong> · ซื้อโดเมนที่ registrar เจ้าไหนก็ได้ แล้วพาเรา&apos;NS&apos;ตามที่ขึ้นในขั้นตอน
          </p>
        </div>
      </header>

      {isProPlus ? (
        <DomainsPanel shopSlug={activeShop.slug} />
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
          <Sparkles className="size-3.5" /> Pro+ Feature
        </span>
        <h2 className="font-display mt-3 text-2xl font-bold leading-tight">
          ใช้โดเมนของคุณเอง
          <br />
          ลูกค้าจำได้ ดูเป็นแบรนด์
        </h2>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/90">
          แทนลิงก์ salepage.in.th/s/... ด้วย mystore.com ของคุณเอง — SSL + DDoS + CDN ฟรีจาก Cloudflare ในตัว
        </p>
      </div>
      <div className="px-6 py-6">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold text-zinc-900">
            ฿399
          </span>
          <span className="text-sm text-zinc-500">/ เดือน — แผน Pro</span>
        </div>
        <Link
          href={dashboardHref("/", undefined) + "#pricing"}
          className={cn(buttonStyles({ size: "lg" }), "mt-4 w-full sm:w-auto")}
        >
          อัปเกรดเป็น Pro
        </Link>
      </div>
    </section>
  );
}
