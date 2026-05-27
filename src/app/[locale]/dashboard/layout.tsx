import { setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireDashboardSession } from "@/lib/dashboard";
import { viewerIsAdmin } from "@/lib/admin";
import type { Locale } from "@/i18n/routing";

export const metadata = {
  title: "Dashboard · SalePage",
  robots: { index: false, follow: false },
};

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
  const shopOptions = shops.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    logoText: s.logoText,
    logoUrl: s.logoUrl,
    themeColor: s.themeColor,
    status: s.status,
  }));
  const userSummary = {
    name: user.name,
    email: user.email,
    image: user.image,
    plan: user.subscription?.plan,
    isAdmin,
  };

  return (
    <DashboardShell
      shops={shopOptions}
      activeShopSlug={activeShop?.slug ?? null}
      user={userSummary}
    >
      {children}
    </DashboardShell>
  );
}
