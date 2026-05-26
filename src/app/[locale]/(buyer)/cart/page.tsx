import { setRequestLocale } from "next-intl/server";
import { CartView } from "./cart-view";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ตะกร้าสินค้า · SalePage",
};

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CartView />;
}
