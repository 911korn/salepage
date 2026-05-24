import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LineOpenBridge } from "@/components/storefront/line-open-bridge";
import { getPlatformLineLiffId } from "@/lib/line";
import type { Locale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ to?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "Open LINE",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LineOpenPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const liffId = getPlatformLineLiffId();
  const query = await searchParams;
  const targetPath = normalizeTargetPath(
    Array.isArray(query.to) ? query.to[0] : query.to,
  );

  if (!liffId) {
    return (
      <main className="grid min-h-dvh place-items-center bg-white px-6 text-center">
        <p className="text-sm font-semibold text-zinc-700">
          ยังไม่ได้เปิดระบบเช็กสถานะผ่าน LINE
        </p>
      </main>
    );
  }

  return <LineOpenBridge liffId={liffId} targetPath={targetPath} />;
}

function normalizeTargetPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/line/orders";
  }

  const target = new URL(value, "https://salepage.in.th");
  const unlocalizedPath = target.pathname.replace(/^\/(th|en)(?=\/)/, "");
  const isOrderStatus = /^\/o\/[^/]+$/.test(unlocalizedPath);
  const isLineOrders = unlocalizedPath === "/line/orders";
  if (!isOrderStatus && !isLineOrders) return "/line/orders";

  return `${target.pathname}${target.search}${target.hash}`;
}
