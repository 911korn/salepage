"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DashboardBottomNav,
  DashboardMobileDrawer,
  DashboardSidebar,
  type DashboardShopOption,
  type DashboardUserSummary,
} from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { resolveDashboardShop } from "@/lib/dashboard-routing";

interface Props {
  shops: DashboardShopOption[];
  activeShopSlug: string | null;
  user: DashboardUserSummary;
  children: React.ReactNode;
}

export function DashboardShell({
  shops,
  activeShopSlug,
  user,
  children,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchParams = useSearchParams();
  const activeShop = resolveDashboardShop(
    shops,
    searchParams.get("shop") ?? activeShopSlug,
  );
  const currentShopSlug = activeShop?.slug ?? activeShopSlug;

  return (
    <div className="flex min-h-screen bg-[color:var(--color-soft)] print:block print:bg-white">
      <DashboardSidebar
        shops={shops}
        activeShopSlug={currentShopSlug}
        user={user}
      />
      <DashboardMobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        shops={shops}
        activeShopSlug={currentShopSlug}
        user={user}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          shop={
            activeShop
              ? { slug: activeShop.slug, name: activeShop.name }
              : null
          }
          onOpenMenu={() => setMobileOpen(true)}
        />
        <main className="flex-1 px-4 pt-5 pb-24 print:p-0 sm:pt-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
      <DashboardBottomNav activeShopSlug={currentShopSlug} />
    </div>
  );
}
