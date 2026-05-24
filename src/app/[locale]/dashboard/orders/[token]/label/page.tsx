import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PrintButton } from "@/components/dashboard/print-button";
import { db } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { dashboardHref } from "@/lib/dashboard-routing";
import { buildOrderRef } from "@/lib/orders";
import type { Locale } from "@/i18n/routing";

export default async function ShippingLabelPage({
  params,
}: {
  params: Promise<{ locale: Locale; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const { shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");

  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: {
      shop: { select: { id: true, slug: true, name: true, contact: true } },
      shipment: true,
    },
  });
  if (!order) notFound();
  if (!shops.some((shop) => shop.id === order.shop.id)) notFound();

  const ref = buildOrderRef(order.createdAt, order.id);
  const publicUrl = `${siteUrl()}/o/${order.publicToken}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    margin: 1,
    width: 150,
  });
  const items = order.items as Array<{
    productName: string;
    qty: number;
    priceSatang: number;
  }>;
  const shipment = order.shipment;
  if (!shipment) notFound();

  return (
    <div className="min-h-screen bg-zinc-100 py-6 text-zinc-950 print:bg-white print:py-0">
      <div className="mx-auto mb-5 flex max-w-[720px] items-center justify-between gap-3 px-4 print:hidden">
        <Link
          href={dashboardHref(`/dashboard/orders/${order.publicToken}`, order.shop.slug)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-white px-3 text-sm font-semibold"
        >
          <ArrowLeft className="size-4" /> กลับออเดอร์
        </Link>
        <PrintButton />
      </div>

      <main className="mx-auto max-w-[420px] bg-white p-5 shadow-xl print:max-w-none print:p-0 print:shadow-none">
        <section className="border-2 border-zinc-950 p-4">
          <div className="flex items-start justify-between gap-4 border-b-2 border-zinc-950 pb-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider">
                SalePage Shipping Label
              </p>
              <h1 className="mt-1 text-xl font-black leading-tight">
                {shipment.courierName}
              </h1>
              {shipment.serviceName ? (
                <p className="text-xs font-semibold">{shipment.serviceName}</p>
              ) : null}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="" className="size-[86px]" />
          </div>

          <div className="border-b-2 border-zinc-950 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider">
              Tracking
            </p>
            <p className="mt-1 break-all font-mono text-2xl font-black tracking-wide">
              {shipment.trackingNumber || "ยังไม่มีเลขพัสดุ"}
            </p>
            <p className="mt-1 font-mono text-[11px]">{ref}</p>
          </div>

          <div className="grid gap-3 border-b-2 border-zinc-950 py-3">
            <AddressBlock
              title="ผู้รับ"
              name={shipment.receiverName || order.customerName}
              phone={shipment.receiverPhone || order.customerPhone}
              address={shipment.receiverAddress || order.customerAddress}
            />
            <AddressBlock
              title="ผู้ส่ง"
              name={shipment.senderName || order.shop.name}
              phone={shipment.senderPhone}
              address={shipment.senderAddress}
            />
          </div>

          <div className="border-b-2 border-zinc-950 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider">
              รายการสินค้า
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {items.map((item, index) => (
                <li key={index} className="flex justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate">{item.productName}</span>
                  <span className="font-bold">x{item.qty}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
            <Info label="น้ำหนัก" value={`${shipment.parcelWeightGram ?? 500}g`} />
            <Info
              label="ขนาด"
              value={
                shipment.parcelLengthCm && shipment.parcelWidthCm && shipment.parcelHeightCm
                  ? `${shipment.parcelLengthCm}x${shipment.parcelWidthCm}x${shipment.parcelHeightCm}cm`
                  : "-"
              }
            />
            <Info label="วิธีส่ง" value={shipment.handoff === "PICKUP" ? "เรียกรับ" : "ฝากส่ง"} />
            <Info label="ค่าส่ง" value={shipment.shippingFeeSatang ? `฿${Math.round(shipment.shippingFeeSatang / 100).toLocaleString()}` : "-"} />
          </div>
        </section>
      </main>
    </div>
  );
}

function AddressBlock({
  title,
  name,
  phone,
  address,
}: {
  title: string;
  name: string | null;
  phone?: string | null;
  address?: string | null;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider">{title}</p>
      <p className="mt-1 text-sm font-black">{name || "-"}</p>
      {phone ? <p className="text-xs font-semibold">{phone}</p> : null}
      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed">
        {address || "-"}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-950 p-2">
      <p className="text-[9px] font-black uppercase tracking-wider">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function siteUrl() {
  const u = process.env.NEXT_PUBLIC_SITE_URL;
  if (u) return u.replace(/\/$/, "");
  const v = process.env.VERCEL_URL;
  if (v) return `https://${v}`;
  return "https://salepage.in.th";
}
