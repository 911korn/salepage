"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  PackageCheck,
  Phone,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import {
  buildLiffRedirectUri,
  buildLineOpenBridgePath,
  fetchLineConfig,
  hasUsableLiffContext,
  initLineLiff,
  isLineInAppBrowser,
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
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const autoLineLookupAttempted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchLineConfig()
      .then((lineConfig) => {
        if (cancelled) return;
        setConfig(lineConfig);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const storedPhone = window.localStorage.getItem(orderPhoneStorageKey(shopSlug)) ?? "";
      queueMicrotask(() => setPhone(storedPhone));
    } catch {
      /* localStorage can be blocked in privacy modes */
    }
  }, [shopSlug]);

  async function lookupByPhone(e?: FormEvent) {
    e?.preventDefault();
    const cleanPhone = phone.replace(/[^\d]/g, "");
    if (cleanPhone.length < 9) {
      toast.error("กรุณากรอกเบอร์โทรให้ครบ");
      return;
    }

    setLoading(true);
    setSearched(true);
    setProfile(null);
    try {
      const res = await fetch("/api/v1/orders/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, shopSlug }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error?.message ?? "ค้นหาออเดอร์ไม่สำเร็จ");
        return;
      }
      setOrders(json.data.orders);
      try {
        window.localStorage.setItem(orderPhoneStorageKey(shopSlug), json.data.phone);
      } catch {
        /* ignore */
      }
    } finally {
      setLoading(false);
    }
  }

  const fetchOrders = useCallback(async (liff: LiffClient) => {
    const idToken = liff.getIDToken();
    if (!idToken) {
      setLineLoading(false);
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
      setLineLoading(false);
      return;
    }
    setProfile(json.data.profile);
    setOrders(json.data.orders);
    setSearched(true);
    setLineLoading(false);
  }, [shopSlug]);

  useEffect(() => {
    if (!config?.liffId || autoLineLookupAttempted.current) return;
    if (!hasUsableLiffContext()) return;

    let cancelled = false;
    autoLineLookupAttempted.current = true;
    queueMicrotask(() => {
      if (!cancelled) setLineLoading(true);
    });

    initLineLiff(config.liffId)
      .then(async (liff) => {
        if (cancelled) return;
        if (!liff.isLoggedIn()) {
          if (isLineInAppBrowser()) {
            liff.login({ redirectUri: buildLiffRedirectUri() });
            return;
          }
          setLineLoading(false);
          return;
        }
        await fetchOrders(liff);
      })
      .catch(() => {
        if (!cancelled) setLineLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [config?.liffId, fetchOrders]);

  async function login() {
    if (!config?.liffId) return;
    setLineLoading(true);
    try {
      if (!hasUsableLiffContext()) {
        window.location.assign(buildLineOpenBridgePath());
        return;
      }

      const liff = await initLineLiff(config.liffId);
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: buildLiffRedirectUri() });
        return;
      }
      await fetchOrders(liff);
    } catch (e) {
      toast.error("Login LINE ไม่สำเร็จ", {
        description: e instanceof Error ? e.message : "กรุณาลองใหม่อีกครั้ง",
      });
      setLineLoading(false);
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
                  <Phone className="size-6" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-xl font-bold tracking-tight">
                  ออเดอร์ของฉัน
                </h1>
                <p className="truncate text-sm text-zinc-600">
                  {profile?.displayName || "ค้นหาด้วยเบอร์โทรที่ใช้สั่งซื้อ"}
                </p>
              </div>
            </div>
          </section>

          <form
            onSubmit={lookupByPhone}
            className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 shadow-sm sm:p-6"
          >
            <label className="text-sm font-bold text-zinc-900" htmlFor="order-phone">
              เบอร์โทรที่ใช้สั่งซื้อ
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="order-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="เช่น 0863273566"
                className="min-h-12 flex-1 rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-base outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-brand-600)] px-5 text-sm font-bold text-white shadow-lg shadow-rose-100 active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                ค้นหาออเดอร์
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              ลูกค้าใหม่สั่งซื้อได้ทันที ไม่ต้อง Login ส่วน LINE เอาไว้ผูกกับเบอร์เพื่อดูครั้งหน้า
            </p>
          </form>

          {loading ? (
            <StateCard
              icon={<Loader2 className="size-6 animate-spin" />}
              title="กำลังโหลดออเดอร์"
              description="กำลังค้นหาจากเบอร์โทรที่ใช้สั่งซื้อ"
            />
          ) : !searched ? (
            <StateCard
              icon={<Phone className="size-6" />}
              title="กรอกเบอร์เพื่อดูออเดอร์"
              description="ใช้เบอร์เดียวกับตอนสั่งซื้อ ระบบจะแสดงออเดอร์ล่าสุดให้เลือก"
            />
          ) : orders.length === 0 ? (
            <StateCard
              icon={<ShoppingBag className="size-6" />}
              title="ยังไม่พบออเดอร์ของเบอร์นี้"
              description="ตรวจสอบเบอร์อีกครั้ง หรือเปิดจากลิงก์สถานะที่ได้รับหลังสั่งซื้อ"
            />
          ) : (
            <section className="space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.token} order={order} />
              ))}
            </section>
          )}

          {config?.configured ? (
            <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#06C755] text-white">
                  <MessageCircle className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold">ตัวเลือกเสริม: ดูด้วย LINE</h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                    ใช้เมื่อต้องการรวมออเดอร์ที่เคยผูกไว้กับบัญชี LINE นี้เท่านั้น
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={login}
                disabled={lineLoading}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 active:scale-[0.99] disabled:opacity-60"
              >
                {lineLoading ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
                ดูออเดอร์ที่ผูกกับ LINE
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function orderPhoneStorageKey(shopSlug?: string | null) {
  return shopSlug ? `salepage:orders-phone:${shopSlug}` : "salepage:orders-phone";
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
