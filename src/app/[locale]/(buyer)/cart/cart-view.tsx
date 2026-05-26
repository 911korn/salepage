"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ShoppingBag, Plus, Minus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  useCart,
  shopsToList,
  selectShopCount,
  selectSubtotalSatang,
} from "@/lib/cart-store";

export function CartView() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const shops = useCart((s) => s.shops);
  const setQty = useCart((s) => s.setQty);
  const removeLine = useCart((s) => s.removeLine);
  const removeShop = useCart((s) => s.removeShop);
  const clear = useCart((s) => s.clear);
  const shopCount = useCart(selectShopCount);
  const grandTotal = useCart(selectSubtotalSatang);

  const shopList = useMemo(() => shopsToList(shops), [shops]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  async function placeOrder() {
    if (shopList.length === 0) return;
    if (name.trim().length < 2) {
      setError("กรุณากรอกชื่อผู้รับ");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Single-shop bag → /orders. Multi-shop → /orders/multi (returns one
      // tracking token per shop). Both endpoints share the public POST
      // shape mobile already exercises.
      if (shopList.length === 1) {
        const shop = shopList[0]!;
        const res = await fetch("/api/v1/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            shopSlug: shop.shopSlug,
            items: shop.items.map((it) => ({
              productSlug: it.productSlug,
              qty: it.qty,
            })),
            customerName: name.trim(),
            customerPhone: phone.trim() || undefined,
            customerAddress: address.trim() || undefined,
            notes: notes[shop.shopSlug]?.trim() || undefined,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: { token: string };
          error?: { message?: string };
        };
        if (!json.ok || !json.data) {
          setError(json.error?.message ?? "ไม่สามารถสั่งซื้อได้");
          return;
        }
        clear();
        router.push(`/o/${json.data.token}`);
      } else {
        const res = await fetch("/api/v1/orders/multi", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            customerName: name.trim(),
            customerPhone: phone.trim() || undefined,
            customerAddress: address.trim() || undefined,
            shops: shopList.map((shop) => ({
              shopSlug: shop.shopSlug,
              items: shop.items.map((it) => ({
                productSlug: it.productSlug,
                qty: it.qty,
              })),
              notes: notes[shop.shopSlug]?.trim() || undefined,
            })),
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: { orders: Array<{ token: string }> };
          error?: { message?: string };
        };
        if (!json.ok || !json.data) {
          setError(json.error?.message ?? "ไม่สามารถสั่งซื้อได้");
          return;
        }
        clear();
        const first = json.data.orders[0]?.token;
        if (first) router.push(`/o/${first}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) {
    return (
      <div className="container-page py-12 text-center text-sm text-zinc-500">
        กำลังโหลด…
      </div>
    );
  }

  if (shopList.length === 0) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-md rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white p-10 text-center">
          <ShoppingBag size={36} className="mx-auto text-zinc-400" />
          <h2 className="mt-3 text-lg font-semibold">ตะกร้าว่าง</h2>
          <p className="mt-1 text-sm text-zinc-500">
            ยังไม่มีสินค้าในตะกร้า ไปเลือกซื้อเลย
          </p>
          <Link
            href="/shops"
            className="mt-5 inline-flex rounded-full bg-[color:var(--color-brand)] px-5 py-2 text-sm font-semibold text-white"
          >
            ดูร้านค้าทั้งหมด
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="mb-2 text-2xl font-bold">ตะกร้าสินค้า</h1>
      <p className="mb-6 text-sm text-zinc-500">
        {shopCount === 1
          ? `${shopList[0]!.shopName} · รวม ฿${(grandTotal / 100).toLocaleString()}`
          : `${shopCount} ร้าน · รวม ฿${(grandTotal / 100).toLocaleString()}`}
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Shop sections */}
        <div className="space-y-4">
          {shopList.map((shop) => (
            <section
              key={shop.shopSlug}
              className="overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white"
            >
              <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
                <div>
                  <Link
                    href={`/s/${shop.shopSlug}`}
                    className="text-sm font-semibold text-[color:var(--color-fg)] hover:underline"
                  >
                    {shop.shopName}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {shop.items.length} รายการ · ฿
                    {(shop.subtotalSatang / 100).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => removeShop(shop.shopSlug)}
                  className="text-xs text-rose-600 hover:underline"
                >
                  ลบทั้งร้าน
                </button>
              </header>
              <ul>
                {shop.items.map((it, idx) => (
                  <li
                    key={it.productSlug}
                    className={`flex gap-3 p-4 ${idx > 0 ? "border-t border-[color:var(--color-border)]" : ""}`}
                  >
                    <div className="size-16 overflow-hidden rounded-xl bg-[color:var(--color-soft)]">
                      {it.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <p className="line-clamp-2 text-sm font-medium">
                        {it.productName}
                      </p>
                      <p className="mt-1 text-sm font-bold text-[color:var(--color-brand)]">
                        ฿{(it.priceSatang / 100).toLocaleString()}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <QtyButton
                          onClick={() =>
                            setQty(shop.shopSlug, it.productSlug, it.qty - 1)
                          }
                        >
                          <Minus size={12} />
                        </QtyButton>
                        <span className="min-w-6 text-center text-sm font-semibold">
                          {it.qty}
                        </span>
                        <QtyButton
                          onClick={() =>
                            setQty(shop.shopSlug, it.productSlug, it.qty + 1)
                          }
                        >
                          <Plus size={12} />
                        </QtyButton>
                        <button
                          onClick={() =>
                            removeLine(shop.shopSlug, it.productSlug)
                          }
                          className="ml-auto text-xs text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-[color:var(--color-border)] px-4 py-3">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  หมายเหตุถึงร้าน (ถ้ามี)
                </label>
                <textarea
                  value={notes[shop.shopSlug] ?? ""}
                  onChange={(e) =>
                    setNotes((prev) => ({ ...prev, [shop.shopSlug]: e.target.value }))
                  }
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[color:var(--color-brand)]/40 focus:outline-none"
                  placeholder="เช่น ใส่หลอดเพิ่ม / ฝากหน้าร้าน"
                  maxLength={500}
                />
              </div>
            </section>
          ))}
        </div>

        {/* Summary + form */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              ข้อมูลผู้รับ
            </h2>
            <FormField label="ชื่อผู้รับ" value={name} onChange={setName} required />
            <FormField
              label="เบอร์โทร"
              value={phone}
              onChange={setPhone}
              placeholder="0xx-xxx-xxxx"
              inputMode="tel"
            />
            <FormField
              label="ที่อยู่จัดส่ง"
              value={address}
              onChange={setAddress}
              multiline
            />
          </div>
          <div className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              สรุป
            </h2>
            {shopList.map((shop) => (
              <SummaryRow
                key={shop.shopSlug}
                label={shop.shopName}
                value={`฿${(shop.subtotalSatang / 100).toLocaleString()}`}
              />
            ))}
            <div className="mt-3 border-t border-[color:var(--color-border)] pt-3">
              <SummaryRow
                label="ยอดรวมทั้งหมด"
                value={`฿${(grandTotal / 100).toLocaleString()}`}
                bold
              />
            </div>
            {error ? (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </p>
            ) : null}
            <button
              onClick={placeOrder}
              disabled={submitting || name.trim().length < 2}
              className="mt-4 w-full rounded-2xl bg-[color:var(--color-brand)] py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting
                ? "กำลังสร้างคำสั่งซื้อ…"
                : `ยืนยันสั่งซื้อ ฿${(grandTotal / 100).toLocaleString()}`}
            </button>
            {shopCount > 1 ? (
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                แต่ละร้านจะมี QR PromptPay ของร้านเอง — ระบบส่งเงินตรงเข้าร้าน
                ไม่หักค่าธรรมเนียม
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function QtyButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-soft)] text-zinc-700 hover:border-[color:var(--color-brand)]/30"
    >
      {children}
    </button>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  required,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "tel" | "text";
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <label className="mt-3 block">
      <span className="text-xs text-zinc-500">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[color:var(--color-brand)]/40 focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[color:var(--color-brand)]/40 focus:outline-none"
        />
      )}
    </label>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-1 ${bold ? "text-base font-bold" : "text-sm"}`}
    >
      <span className="text-zinc-600">{label}</span>
      <span className={bold ? "text-[color:var(--color-brand)]" : "text-zinc-900"}>
        {value}
      </span>
    </div>
  );
}
