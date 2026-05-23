import { Bell } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { resolveDashboardShop } from "@/lib/dashboard-routing";
import { AnnouncementForm } from "@/components/dashboard/announcement-form";
import type { Locale } from "@/i18n/routing";

export default async function AnnouncementsPage({
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
  if (!activeShop) {
    return null;
  }

  const shop = await db.shop.findUnique({
    where: { id: activeShop.id },
    select: { slug: true, announcement: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-[color:var(--color-brand-600)]" />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            ประกาศหน้าร้าน
          </h1>
        </div>
        <p className="mt-1 text-[13px] text-zinc-500">
          ขึ้นแบนเนอร์เล็กๆ บนหน้าร้าน เช่น โปรโมชั่นพิเศษ ส่งฟรี หรือวันหยุดของร้าน
        </p>
      </header>

      <AnnouncementForm
        shopSlug={shop?.slug ?? activeShop.slug}
        initial={shop?.announcement ?? ""}
      />
    </div>
  );
}
