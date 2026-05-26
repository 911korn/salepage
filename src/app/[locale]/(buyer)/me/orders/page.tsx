import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { ALLOWED_STATUSES, runMeOrdersQuery } from "@/lib/me-orders-shared";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "คำสั่งซื้อของฉัน · SalePage",
};

const TAB_LABELS: Record<string, string> = {
  ALL: "ทั้งหมด",
  PENDING: "รอชำระเงิน",
  PAID: "ชำระแล้ว",
  SHIPPING: "กำลังส่ง",
  DELIVERED: "ได้รับแล้ว",
  CANCELLED: "ยกเลิก",
};

const STATUS_TABS = ["ALL", ...ALLOWED_STATUSES] as const;

interface PageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string }>;
}

export default async function MeOrdersPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/me/orders")}`);
  }

  const status = sp.status && ALLOWED_STATUSES.includes(sp.status as (typeof ALLOWED_STATUSES)[number])
    ? (sp.status as (typeof ALLOWED_STATUSES)[number])
    : null;

  // Same source of truth as GET /api/v1/me/orders (mobile uses the HTTP
  // route; web's server component calls the underlying helper directly
  // for SSR speed). Both pull from `runMeOrdersQuery` so the
  // OR-matchers + self-purchase exclusion stay in sync.
  const { orders, counts } = await runMeOrdersQuery({
    userId: session.user.id,
    status,
  });

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold">คำสั่งซื้อของฉัน</h1>
      <p className="mt-1 text-sm text-zinc-500">รวมทุกร้านที่ใช้อีเมลเดียวกัน</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = (status ?? "ALL") === tab;
          const count = tab === "ALL" ? total : counts[tab] ?? 0;
          return (
            <Link
              key={tab}
              href={tab === "ALL" ? "/me/orders" : `/me/orders?status=${tab}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                isActive
                  ? "border-[color:var(--color-brand)]/40 bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]"
                  : "border-[color:var(--color-border)] bg-white text-zinc-700"
              }`}
            >
              {TAB_LABELS[tab]}
              {count > 0 ? ` (${count})` : ""}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white p-10 text-center text-sm text-zinc-500">
          ยังไม่มีคำสั่งซื้อในหมวดนี้
        </div>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white">
          {orders.map((o, i) => {
            const isPending = o.status === "PENDING";
            return (
              <li
                key={o.token}
                className={`${i > 0 ? "border-t border-[color:var(--color-border)]" : ""} ${
                  isPending ? "bg-rose-50/40" : ""
                }`}
              >
                <Link
                  href={
                    isPending
                      ? `/checkout/${o.token}`
                      : `/o/${o.token}`
                  }
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[color:var(--color-soft)]/60"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold">
                        {o.shopName}
                      </span>
                      <span className="text-sm font-bold text-[color:var(--color-brand)]">
                        ฿{(o.totalSatang / 100).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                      {isPending ? (
                        <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          รอชำระเงิน
                        </span>
                      ) : null}
                      <span>{TAB_LABELS[o.status] ?? o.status}</span>
                      <span className="ml-auto text-zinc-400">
                        {new Date(o.createdAt).toLocaleString("th-TH", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-zinc-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
