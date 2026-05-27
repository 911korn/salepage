import { notFound } from "next/navigation";
import { ArrowLeft, Check, MapPin, ShieldCheck, Truck, XCircle } from "lucide-react";
import { DigitalFulfillmentCard } from "@/components/storefront/digital-fulfillment-card";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { TrackingPanel } from "@/components/storefront/tracking-panel";
import { CancelOrderSection } from "@/components/storefront/cancel-order-section";
import { ReviewForm } from "@/components/storefront/review-form";
import { LineOrderLinker } from "@/components/storefront/line-order-linker";
import { cn } from "@/lib/cn";
import { db, OrderStatus } from "@/lib/db";
import { generatePromptPay } from "@/lib/promptpay";
import { buildOrderRef } from "@/lib/orders";
import { storefrontLabel, storefrontPath } from "@/lib/storefront-url";
import type { Locale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: Locale; token: string }>;
}

export default async function OrderTrackingPage({ params }: PageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const order = await db.order.findUnique({
    where: { publicToken: token },
    include: {
      shipment: true,
      shop: {
        select: {
          slug: true,
          name: true,
          logoText: true,
          logoUrl: true,
          themeColor: true,
          verified: true,
          promptpayId: true,
          contact: true,
        },
      },
    },
  });
  if (!order) notFound();

  const t = await getTranslations("order.tracking");

  // Server-generate QR for fast first paint (also returned by API for client refresh)
  let qrDataUrl: string | null = null;
  if (order.status === OrderStatus.PENDING && order.shop.promptpayId) {
    try {
      const qr = await generatePromptPay({
        id: order.shop.promptpayId,
        amount: order.totalSatang / 100,
      });
      qrDataUrl = qr.dataUrl;
    } catch {
      /* ok — show fallback */
    }
  }

  const ref = buildOrderRef(order.createdAt, order.id);
  const shopContact = buildShopContact(order.shop.contact);
  const items = order.items as Array<{
    productSlug: string;
    productName: string;
    qty: number;
    priceSatang: number;
    image?: string;
  }>;

  const canReview =
    order.status === OrderStatus.SHIPPING ||
    order.status === OrderStatus.DELIVERED;
  let alreadyReviewed = false;
  if (canReview) {
    const existing = await db.review.findFirst({
      where: { orderId: order.id },
      select: { id: true },
    });
    alreadyReviewed = !!existing;
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-soft)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-white/85 backdrop-blur-xl">
        <div className="container-page flex h-14 items-center justify-between">
          <Link
            href={storefrontPath(order.shop.slug)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-[color:var(--color-fg)]"
          >
            <ArrowLeft className="size-4" /> {order.shop.name}
          </Link>
          <p className="font-mono text-xs text-zinc-500">{ref}</p>
          <span />
        </div>
      </header>

      <div className="container-page py-6 lg:py-10">
        <div className="mx-auto max-w-3xl space-y-5">
          <header className="flex items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {t("title", { ref })}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
            </div>
            <StatusBadge status={order.status} />
          </header>

          <LineOrderLinker
            token={order.publicToken}
            initiallyLinked={Boolean(order.customerLineUserId)}
            displayName={order.customerLineDisplayName}
            pictureUrl={order.customerLinePictureUrl}
          />

          {order.status === OrderStatus.PENDING ? (
            <TrackingPanel
              token={token}
              amount={order.totalSatang / 100}
              receiver={order.shop.promptpayId ?? ""}
              qrDataUrl={qrDataUrl}
              shopName={order.shop.name}
              initialManualReview={Boolean(order.slipImageUrl && order.slipProvider === "manual")}
              shopContact={shopContact}
            />
          ) : (
            <OrderStateCard
              status={order.status}
              paidText={t("verified")}
              manualPaidText={t("manualPaid")}
              cancelledText={t("cancelledStatusText")}
              refundedText={t("refundedStatusText")}
              slipProvider={order.slipProvider}
              slipRef={order.slipRef}
            />
          )}

          {/* V2.1 digital fulfillment surface — shows the buyer the
              content they paid for (game ID:PW, license keys, links,
              instructions). Snapshot taken at the slip-verified PAID
              transition so future product edits don't mutate past
              orders (911korn 2026-05-27). */}
          {order.digitalFulfillment ? (
            <DigitalFulfillmentCard
              content={order.digitalFulfillment}
              fulfilledAt={order.digitalFulfilledAt?.toISOString() ?? null}
            />
          ) : null}

          {isFulfillmentStatus(order.status) ? (
            <ShipmentStatusCard
              status={order.status}
              shipment={order.shipment}
              trackingNumber={order.trackingNumber}
            />
          ) : null}

          {/* Items */}
          <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold">{t("items")}</h2>
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

          {canReview && !alreadyReviewed ? (
            <ReviewForm
              shopSlug={order.shop.slug}
              orderToken={order.publicToken}
              productSlug={items[0]?.productSlug ?? null}
            />
          ) : null}

          {/* Customer info */}
          <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 text-sm sm:p-6">
            <h2 className="font-display mb-3 text-base font-semibold">
              {t("customer")}
            </h2>
            <p className="font-medium">{order.customerName}</p>
            {order.customerPhone ? (
              <p className="text-zinc-600">{order.customerPhone}</p>
            ) : null}
            {order.customerAddress ? (
              <>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t("shippingAddress")}
                </p>
                <p className="whitespace-pre-line text-zinc-700">
                  {order.customerAddress}
                </p>
              </>
            ) : null}
          </section>

          {/* Cancel CTA moved to the very bottom (was a prominent red
              card under the QR — too easy to mis-tap). 911korn 2026-05-27
              "ย้ายปุ่มยกเลิก Order ไปไว้ล่างสุด ป้องกันกดผิด". Renders as
              a small underline link only while PENDING. */}
          {order.status === OrderStatus.PENDING ? (
            <CancelOrderSection token={order.publicToken} />
          ) : null}

          {/* Shop link */}
          <Link
            href={storefrontPath(order.shop.slug)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white p-4 transition-colors hover:bg-[color:var(--color-soft)]",
            )}
          >
            <span
              className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl font-display font-bold text-white"
              style={{ background: order.shop.themeColor }}
            >
              {order.shop.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={order.shop.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                order.shop.logoText ?? order.shop.name.slice(0, 1)
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold">{order.shop.name}</p>
                {order.shop.verified ? (
                  <ShieldCheck className="size-4 text-[color:var(--color-brand-600)]" />
                ) : null}
              </div>
              <p className="text-[11px] text-zinc-500">
                {storefrontLabel(order.shop.slug)}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  if (status === OrderStatus.PENDING)
    return (
      <Badge tone="warning" className="text-[11px]">
        รอชำระ
      </Badge>
    );
  if (status === OrderStatus.PAID)
    return <Badge tone="success" className="text-[11px]">ชำระแล้ว</Badge>;
  if (status === OrderStatus.SHIPPING)
    return <Badge tone="soft-brand" className="text-[11px]">จัดส่งแล้ว</Badge>;
  if (status === OrderStatus.DELIVERED)
    return <Badge tone="success" className="text-[11px]">ส่งสำเร็จ</Badge>;
  return <Badge tone="neutral" className="text-[11px]">ยกเลิก</Badge>;
}

function paymentStatusText(status: OrderStatus, paidText: string) {
  if (status === OrderStatus.SHIPPING) {
    return "ชำระเงินแล้ว และร้านเริ่มจัดส่งพัสดุแล้ว";
  }
  if (status === OrderStatus.DELIVERED) {
    return "ชำระเงินแล้ว และจัดส่งสำเร็จแล้ว";
  }
  return paidText;
}

function OrderStateCard({
  status,
  paidText,
  manualPaidText,
  cancelledText,
  refundedText,
  slipProvider,
  slipRef,
}: {
  status: OrderStatus;
  paidText: string;
  manualPaidText: string;
  cancelledText: string;
  refundedText: string;
  slipProvider: string | null;
  slipRef: string | null;
}) {
  const cancelled =
    status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED;
  const manualPaid = status === OrderStatus.PAID && slipProvider === "manual";

  return (
    <div
      className={cn(
        "rounded-3xl border p-5 sm:p-7",
        cancelled
          ? "border-rose-200 bg-rose-50"
          : "border-emerald-200 bg-emerald-50",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl bg-white",
            cancelled ? "text-rose-600" : "text-emerald-600",
          )}
        >
          {cancelled ? (
            <XCircle className="size-5" strokeWidth={3} />
          ) : (
            <Check className="size-5" strokeWidth={3} />
          )}
        </span>
        <div>
          <p
            className={cn(
              "font-display text-base font-bold",
              cancelled ? "text-rose-900" : "text-emerald-900",
            )}
          >
            {cancelled
              ? status === OrderStatus.REFUNDED
                ? refundedText
                : cancelledText
              : manualPaid
                ? manualPaidText
              : paymentStatusText(status, paidText)}
          </p>
          {slipRef && !cancelled ? (
            <p className="break-all font-mono text-[11px] text-emerald-800">
              ref: {slipRef}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function isFulfillmentStatus(status: OrderStatus) {
  return (
    status === OrderStatus.PAID ||
    status === OrderStatus.SHIPPING ||
    status === OrderStatus.DELIVERED
  );
}

function ShipmentStatusCard({
  status,
  shipment,
  trackingNumber,
}: {
  status: OrderStatus;
  shipment: {
    courierName: string;
    serviceName: string | null;
    handoff: string;
    trackingNumber: string | null;
    receiverAddress: string | null;
  } | null;
  trackingNumber: string | null;
}) {
  const code = shipment?.trackingNumber ?? trackingNumber;
  const courier = shipment?.courierName ?? "ร้านค้าจะอัปเดตขนส่งให้เร็ว ๆ นี้";
  const done = status === OrderStatus.DELIVERED;

  return (
    <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
          <Truck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold">
            {done ? "ส่งสำเร็จแล้ว" : status === OrderStatus.SHIPPING ? "พัสดุกำลังจัดส่ง" : "ร้านกำลังเตรียมพัสดุ"}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">{courier}</p>
          {shipment?.serviceName ? (
            <p className="text-[12px] text-zinc-500">{shipment.serviceName}</p>
          ) : null}
        </div>
      </div>

      {code ? (
        <div className="mt-4 rounded-2xl bg-[color:var(--color-soft)] px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            เลขพัสดุ
          </p>
          <p className="mt-1 break-all font-mono text-base font-bold">{code}</p>
        </div>
      ) : null}

      {shipment?.receiverAddress ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[color:var(--color-soft)] px-3.5 py-3 text-sm text-zinc-600">
          <MapPin className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand-600)]" />
          <p className="whitespace-pre-line">{shipment.receiverAddress}</p>
        </div>
      ) : null}
    </section>
  );
}

function buildShopContact(contact: unknown) {
  const parsed = contact as {
    phone?: string | null;
    line?: string | null;
  } | null;
  const phone = parsed?.phone?.trim() || null;
  const line = parsed?.line?.trim() || null;
  const phoneNumber = phone?.replace(/[^\d+]/g, "") || null;
  return {
    phone,
    phoneUrl: phoneNumber ? `tel:${phoneNumber}` : null,
    line,
    lineUrl: line ? buildLineUrl(line) : null,
  };
}

function buildLineUrl(line: string) {
  if (line.startsWith("http://") || line.startsWith("https://")) return line;
  return `https://line.me/R/ti/p/${line.startsWith("@") ? "%40" + line.slice(1) : line}`;
}
