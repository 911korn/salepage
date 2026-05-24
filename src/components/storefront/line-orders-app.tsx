"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import {
  fetchLineConfig,
  initLineLiff,
  type LiffClient,
  type LineConfig,
} from "@/lib/line-liff-client";

interface Props {
  shopSlug?: string | null;
}

interface LineOrder {
  token: string;
  ref: string;
  status: string;
  totalSatang: number;
  trackingNumber: string | null;
  createdAt: string;
  shop: {
    slug: string;
    name: string;
    logoText: string | null;
    logoUrl: string | null;
    themeColor: string;
  };
  shipment: {
    courierName: string;
    serviceName: string | null;
    trackingNumber: string | null;
    status: string;
  } | null;
  items: Array<{ name: string; qty: number; image: string | null }>;
}

export function LineOrdersApp({ shopSlug }: Props) {
  const [config, setConfig] = useState<LineConfig | null>(null);
  const [orders, setOrders] = useState<LineOrder[]>([]);
  const [profile, setProfile] = useState<{
    displayName: string | null;
    pictureUrl: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLineConfig()
      .then(async (lineConfig) => {
        if (cancelled) return;
        if (!lineConfig.configured || !lineConfig.liffId) {
          setConfig({ liffId: null, configured: false });
          setLoading(false);
          return;
        }
        setConfig(lineConfig);
        const liff = await initLineLiff(lineConfig.liffId);
        if (cancelled) return;
        if (!liff.isLoggedIn()) {
          setNeedsLogin(true);
          setLoading(false);
          return;
        }
        await fetchOrders(liff);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error("เปิด LINE ไม่สำเร็จ", {
          description: e instanceof Error ? e.message : "กรุณาลองใหม่อีกครั้ง",
        });
        setNeedsLogin(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopSlug]);

  async function fetchOrders(liff: LiffClient) {
    const idToken = liff.getIDToken();
    if (!idToken) {
      setNeedsLogin(true);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/v1/line/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken, shopSlug }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      toast.error(json.error?.message ?? "โหลดออเดอร์ไม่สำเร็จ");
      setLoading(false);
      return;
    }
    setProfile(json.data.profile);
    setOrders(json.data.orders);
    setNeedsLogin(false);
    setLoading(false);
  }

  async function login() {
    if (!config?.liffId) return;
    setLoading(true);
    try {
      const liff = await initLineLiff(config.liffId);
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }
      await fetchOrders(liff);
    } catch (e) {
      toast.error("Login LINE ไม่สำเร็จ", {
        description: e instanceof Error ? e.message : "กรุณาลองใหม่อีกครั้ง",
      });
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--color-soft)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-white/90 backdrop-blur-xl">
        <div className="container-page flex h-14 items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
            <ArrowLeft className="size-4" /> SalePage
          </Link>
          <p className="truncate text-sm font-bold">สถานะออเดอร์</p>
          <span className="w-16" />
        </div>
      </header>

      <div className="container-page py-5 sm:py-8">
        <div className="mx-auto max-w-2xl space-y-5">
          <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#06C755] text-white">
                {profile?.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.pictureUrl} alt="" className="size-full object-cover" />
                ) : (
                  <MessageCircle className="size-6" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-xl font-bold tracking-tight">
                  ออเดอร์ของฉัน
                </h1>
                <p className="truncate text-sm text-zinc-600">
                  {profile?.displayName || "ดูสถานะจากบัญชี LINE นี้"}
                </p>
              </div>
            </div>
          </section>

          {loading ? (
            <StateCard
              icon={<Loader2 className="size-6 animate-spin" />}
              title="กำลังโหลดออเดอร์"
              description="กำลังตรวจสอบออเดอร์จากบัญชี LINE นี้"
            />
          ) : !config?.configured ? (
            <StateCard
              icon={<MessageCircle className="size-6" />}
              title="ยังไม่ได้เปิดระบบเช็กสถานะผ่าน LINE"
              description="ทีม SalePage ต้องตั้งค่า LIFF ID และ LINE Login Channel ก่อน"
            />
          ) : needsLogin ? (
            <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#06C755] text-white">
                  <MessageCircle className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold">เข้าสู่ LINE เพื่อดูสถานะออเดอร์</h2>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                    ระบบจะหาออเดอร์ที่เคยบันทึกไว้กับบัญชี LINE นี้
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={login}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#06C755] px-4 text-sm font-bold text-white shadow-lg shadow-emerald-100 active:scale-[0.99]"
              >
                <MessageCircle className="size-4" />
                ดูสถานะด้วย LINE
              </button>
            </section>
          ) : orders.length === 0 ? (
            <StateCard
              icon={<ShoppingBag className="size-6" />}
              title="ยังไม่มีออเดอร์ในบัญชี LINE นี้"
              description="หลังสั่งซื้อ กดเช็กสถานะด้วย LINE บนหน้าสถานะออเดอร์ครั้งแรก แล้วออเดอร์จะมาอยู่ตรงนี้"
            />
          ) : (
            <section className="space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.token} order={order} />
              ))}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function OrderCard({ order }: { order: LineOrder }) {
  const firstItem = order.items[0];
  return (
    <a
      href={`/o/${order.token}`}
      className="block rounded-3xl border border-[color:var(--color-border)] bg-white p-4 shadow-sm transition active:scale-[0.995] sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl font-display text-lg font-bold text-white"
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
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{order.shop.name}</p>
              <p className="font-mono text-[11px] text-zinc-500">{order.ref}</p>
            </div>
            <StatusPill status={order.status} />
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[color:var(--color-soft)] p-3">
            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
              {firstItem?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={firstItem.image} alt="" className="size-full object-cover" />
              ) : (
                <PackageCheck className="size-5 text-zinc-500" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {firstItem?.name ?? "รายการสินค้า"}
              </p>
              <p className="text-xs text-zinc-500">
                {order.items.length > 1
                  ? `${order.items.length} รายการ`
                  : `x ${firstItem?.qty ?? 1}`}
              </p>
            </div>
            <p className="text-sm font-bold text-[color:var(--color-brand-700)]">
              ฿{(order.totalSatang / 100).toLocaleString("th-TH")}
            </p>
          </div>

          {order.trackingNumber ? (
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-zinc-700">
              <Truck className="size-4 text-[color:var(--color-brand-600)]" />
              <span className="min-w-0 truncate">{order.trackingNumber}</span>
            </div>
          ) : null}
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-zinc-400" />
      </div>
    </a>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "รอชำระ", cls: "bg-amber-50 text-amber-700 ring-amber-100" },
    PAID: { label: "ชำระแล้ว", cls: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
    SHIPPING: { label: "จัดส่ง", cls: "bg-blue-50 text-blue-700 ring-blue-100" },
    DELIVERED: { label: "สำเร็จ", cls: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
    CANCELLED: { label: "ยกเลิก", cls: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
    REFUNDED: { label: "คืนเงิน", cls: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
  };
  const item = map[status] ?? map.PENDING;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${item.cls}`}>
      {item.label}
    </span>
  );
}

function StateCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-6 text-center shadow-sm">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[color:var(--color-soft)] text-zinc-600">
        {icon}
      </span>
      <h2 className="mt-4 text-base font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-zinc-600">
        {description}
      </p>
    </section>
  );
}
