import { setRequestLocale } from "next-intl/server";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { requireDashboardSession } from "@/lib/dashboard";
import { viewerIsAdmin } from "@/lib/admin";
import type { Locale } from "@/i18n/routing";

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { user, shops } = await requireDashboardSession();
  const isAdmin = await viewerIsAdmin();

  // Default to first shop; UI can switch via ?shop=slug
  const activeShop = shops[0];

  return (
    <div className="flex min-h-screen bg-[color:var(--color-soft)]">
      <DashboardSidebar
        shops={shops.map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          logoText: s.logoText,
          themeColor: s.themeColor,
          status: s.status,
        }))}
        activeShopSlug={activeShop?.slug ?? null}
        user={{
          name: user.name,
          email: user.email,
          image: user.image,
          plan: user.subscription?.plan,
          isAdmin,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          shop={activeShop ? { slug: activeShop.slug, name: activeShop.name } : null}
        />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
