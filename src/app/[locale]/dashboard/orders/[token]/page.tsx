import { notFound, redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { OrderActions } from "@/components/dashboard/order-actions";
import { ShippingWorkflow } from "@/components/dashboard/shipping-workflow";
import { EasyParcelPanel } from "@/components/dashboard/easyparcel-panel";
import { cn } from "@/lib/cn";
import { db, OrderStatus } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { dashboardHref } from "@/lib/dashboard-routing";
import { buildOrderRef } from "@/lib/orders";
import { hasProPlan } from "@/lib/plan";
import { buttonStyles } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const { user, shops } = await requireDashboardSession();
  if (shops.length === 0) redirect("/dashboard/create-shop");

  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: {
      shop: { select: { id: true, ownerId: true, slug: true, name: true } },
      shipment: true,
    },
  });
  if (!order) notFound();
  // Defense-in-depth: order must belong to a shop the signed-in user owns.
  if (!shops.some((s) => s.id === order.shop.id)) notFound();

  const t = await getTranslations("dashboard.orders.detail");
  const ref = buildOrderRef(order.createdAt, order.id);
  const shippingEligible = await hasProPlan(user.id);
  const items = order.items as Array<{
    productSlug: string;
    productName: string;
    qty: number;
    priceSatang: number;
    image?: string;
  }>;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={dashboardHref("/dashboard/orders", order.shop.slug)}
            className="grid size-9 place-items-center rounded-lg border border-[color:var(--color-border)] bg-white hover:bg-[color:var(--color-soft)]"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              {t("title", { ref })}
            </h1>
            <p className="text-xs text-zinc-500">
              {order.createdAt.toLocaleString()}
            </p>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: items + customer */}
        <div className="space-y-5">
          <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold">
              {t("items")}
            </h2>
            <ul className="mt-3 divide-y divide-[color:var(--color-border)]">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-100">
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {it.productName}
                    </p>
                    <p className="text-[11px] text-zinc-500">x {it.qty}</p>
                  </div>
                  <span className="text-sm font-semibold">
                    ฿{((it.priceSatang * it.qty) / 100).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-[color:var(--color-border)] pt-3 text-sm">
              <div className="flex justify-between text-zinc-600">
                <dt>Subtotal</dt>
                <dd>฿{(order.subtotalSatang / 100).toLocaleString()}</dd>
              </div>
              {order.shippingSatang > 0 ? (
                <div className="flex justify-between text-zinc-600">
                  <dt>Shipping</dt>
                  <dd>฿{(order.shippingSatang / 100).toLocaleString()}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-[color:var(--color-border)] pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="text-[color:var(--color-brand-700)]">
                  ฿{(order.totalSatang / 100).toLocaleString()}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 text-sm sm:p-6">
            <h2 className="font-display mb-3 text-base font-semibold">
              {t("customer")}
            </h2>
            <p className="font-medium">{order.customerName}</p>
            {order.customerPhone ? (
              <p className="text-zinc-600">{order.customerPhone}</p>
            ) : null}
            {order.customerEmail ? (
              <p className="text-zinc-600">{order.customerEmail}</p>
            ) : null}
            {order.customerAddress ? (
              <>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t("shipping")}
                </p>
                <p className="whitespace-pre-line text-zinc-700">
                  {order.customerAddress}
                </p>
              </>
            ) : null}
          </section>

          {order.notes ? (
            <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 text-sm sm:p-6">
              <h2 className="font-display mb-3 text-base font-semibold">
                {t("notes")}
              </h2>
              <p className="whitespace-pre-line text-zinc-700">{order.notes}</p>
            </section>
          ) : null}
        </div>

        {/* Right: actions */}
        <aside className="space-y-5">
          <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 text-sm sm:p-6">
            <h2 className="font-display mb-3 text-base font-semibold">
              {t("payment")}
            </h2>
            <dl className="space-y-2 text-[13px]">
              <Row label="Method" value={order.paymentMethod ?? "-"} />
              {order.slipRef ? (
                <Row label={t("slipRef")} value={order.slipRef} mono />
              ) : null}
              {order.slipVerifiedAt ? (
                <Row
                  label="Verified at"
                  value={order.slipVerifiedAt.toLocaleString()}
                />
              ) : null}
              {order.slipProvider ? (
                <Row label="Provider" value={order.slipProvider} />
              ) : null}
            </dl>
            {order.slipImageUrl ? (
              <a
                href={order.slipImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-soft)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={order.slipImageUrl}
                  alt="Payment slip"
                  className="max-h-80 w-full object-contain"
                />
              </a>
            ) : null}
            {order.status === OrderStatus.PENDING && order.slipProvider === "manual" ? (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-bold">มีสลิปรอตรวจด้วยมือ</p>
                  <p className="mt-0.5 leading-relaxed">
                    ตรวจยอดและบัญชีรับเงินจากสลิปนี้ ถ้าถูกต้องให้กด
                    “ยืนยันว่าชำระแล้ว” เพื่อหักสต็อกและเริ่มจัดส่ง
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          {/* V2.1 EasyParcel Pro auto-shipping (911korn 2026-05-27
              "ทำให้เหมือน Shopee"). Mounts above the manual workflow
              so Pro sellers see the auto-label CTA first; free-tier
              sellers can still type a tracking number below. */}
          {(order.status === "PAID" || order.status === "SHIPPING") ? (
            <EasyParcelPanel
              token={order.publicToken}
              initialAwb={order.shipment?.trackingNumber ?? null}
              initialLabelUrl={order.shipment?.labelUrl ?? null}
            />
          ) : null}

          {shippingEligible ? (
            <ShippingWorkflow
              token={order.publicToken}
              currentStatus={order.status}
              orderRef={ref}
              shopName={order.shop.name}
              customerName={order.customerName}
              customerPhone={order.customerPhone}
              customerAddress={order.customerAddress}
              trackingNumber={order.trackingNumber}
              shipment={order.shipment}
            />
          ) : (
            <AutoShippingUpgrade />
          )}

          <OrderActions
            token={order.publicToken}
            currentStatus={order.status}
            trackingNumber={order.trackingNumber}
            shippingManaged={shippingEligible}
          />

          <Link
            href={`/o/${order.publicToken}`}
            target="_blank"
            className={cn(
              buttonStyles({ variant: "outline", size: "md" }),
              "w-full",
            )}
          >
            <ExternalLink className="size-4" /> {t("actions.viewPublic")}
          </Link>
        </aside>
      </div>
    </div>
  );
}

function AutoShippingUpgrade() {
  return (
    <section className="rounded-3xl border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-5 text-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-[color:var(--color-brand-600)]">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-[color:var(--color-brand-900)]">
            Auto Shipping สำหรับ Pro ขึ้นไป
          </h2>
          <p className="mt-1 leading-relaxed text-[color:var(--color-brand-800)]">
            แพ็กปัจจุบันยังใช้การใส่เลขพัสดุแบบ manual ได้ ส่วนการเตรียมพัสดุ
            ใบปะหน้า และ workflow ขนส่งแบบ marketplace จะเปิดในแพ็ก Pro+
          </p>
          <Link
            href="/#pricing"
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3 text-[13px] font-semibold text-[color:var(--color-brand-700)] ring-1 ring-[color:var(--color-brand-200)]"
          >
            ดูแพ็กเกจ
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  if (status === OrderStatus.PENDING)
    return <Badge tone="warning" className="text-[11px]">PENDING</Badge>;
  if (status === OrderStatus.PAID)
    return <Badge tone="success" className="text-[11px]">PAID</Badge>;
  if (status === OrderStatus.SHIPPING)
    return <Badge tone="soft-brand" className="text-[11px]">SHIPPING</Badge>;
  if (status === OrderStatus.DELIVERED)
    return <Badge tone="success" className="text-[11px]">DELIVERED</Badge>;
  return <Badge tone="neutral" className="text-[11px]">{status}</Badge>;
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd
        className={cn(
          "min-w-0 max-w-[60%] truncate text-right",
          mono && "font-mono text-[12px]",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
