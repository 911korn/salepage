import { setRequestLocale } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · SalePage",
  robots: { index: false, follow: false },
};

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireAdmin();
  return <AdminShell viewer={viewer}>{children}</AdminShell>;
}
