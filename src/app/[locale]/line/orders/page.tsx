import { setRequestLocale } from "next-intl/server";
import { LineLiffGate } from "@/components/storefront/line-liff-gate";
import { LineOrdersApp } from "@/components/storefront/line-orders-app";
import type { Locale } from "@/i18n/routing";

export const metadata = {
  title: "ออเดอร์ของฉัน | SalePage LINE",
};

export default async function LineOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ shop?: string | string[] }>;
}) {
  const { locale } = await params;
  const { shop } = await searchParams;
  setRequestLocale(locale);

  return (
    <>
      <LineLiffGate />
      <LineOrdersApp shopSlug={Array.isArray(shop) ? shop[0] : shop ?? null} />
    </>
  );
}
