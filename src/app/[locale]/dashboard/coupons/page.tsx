import { Ticket } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop } from "@/lib/dashboard-routing";
import {
  CouponsManager,
  type CouponView,
} from "@/components/dashboard/coupons-manager";
import type { Locale } from "@/i18n/routing";

export default async function CouponsPage({
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
  if (!activeShop) return null;

  const coupons = await db.coupon.findMany({
    where: { shopId: activeShop.id },
    orderBy: { createdAt: "desc" },
  });
  const view: CouponView[] = coupons.map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    percent: c.percent,
    amountSatang: c.amountSatang,
    minOrderSatang: c.minOrderSatang,
    maxRedemptions: c.maxRedemptions,
    redeemedCount: c.redeemedCount,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    active: c.active,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Ticket className="size-5 text-[color:var(--color-brand-600)]" />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            คูปองส่วนลด
          </h1>
        </div>
        <p className="mt-1 text-[13px] text-zinc-500">
          ตั้งโค้ดส่วนลดให้ลูกค้าใส่ตอน checkout เช่น WELCOME10, NEWYEAR50
        </p>
      </header>

      <CouponsManager shopSlug={activeShop.slug} initial={view} />
    </div>
  );
}
