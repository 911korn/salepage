"use client";

import { useEffect, useState, useTransition } from "react";
import { Minus, Plus, ShoppingBag, Sparkles, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface Props {
  shopSlug: string;
  product: {
    slug: string;
    name: string;
    priceBaht: number;
    type: "PHYSICAL" | "DIGITAL";
  };
}

export function CheckoutPanel({ shopSlug, product }: Props) {
  const t = useTranslations("order.checkout");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{
    code: string;
    discountBaht: number;
  } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const [loyalty, setLoyalty] = useState<{
    points: number;
    bahtValuePerPoint: number;
  } | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(0);

  const subtotal = product.priceBaht * qty;
  const shipping = 0; // v1: shop sets per-product shipping later
  const couponDiscount = couponApplied?.discountBaht ?? 0;
  const pointsDiscount =
    redeemPoints * (loyalty?.bahtValuePerPoint ?? 0);
  const total = Math.max(0, subtotal + shipping - couponDiscount - pointsDiscount);
  const needsAddress = product.type === "PHYSICAL";

  // Look up loyalty wallet when phone has 9+ digits
  useEffect(() => {
    const cleanPhone = phone.replace(/[^\d]/g, "");
    if (cleanPhone.length < 9) {
      setLoyalty(null);
      setRedeemPoints(0);
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/shops/${shopSlug}/loyalty/${cleanPhone}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.ok) return;
        if (json.data.points > 0 && json.data.config.bahtValuePerPoint > 0) {
          setLoyalty({
            points: json.data.points,
            bahtValuePerPoint: json.data.config.bahtValuePerPoint,
          });
        } else {
          setLoyalty(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phone, shopSlug]);

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponChecking(true);
    try {
      const res = await fetch(`/api/v1/shops/${shopSlug}/coupons/redeem`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          subtotalSatang: subtotal * 100,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ใช้คูปองไม่ได้");
        setCouponApplied(null);
        return;
      }
      setCouponApplied({
        code: json.data.code,
        discountBaht: Math.round(json.data.discountSatang / 100),
      });
      toast.success(
        `ใช้คูปอง ${json.data.code.toUpperCase()} แล้ว — ลด ฿${Math.round(json.data.discountSatang / 100).toLocaleString()}`,
      );
    } finally {
      setCouponChecking(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error(t("errors.nameRequired"));
    if (!phone.trim()) return toast.error(t("errors.phoneRequired"));
    if (needsAddress && !address.trim())
      return toast.error(t("errors.addressRequired"));

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            shopSlug,
            items: [{ productSlug: product.slug, qty }],
            customerName: name.trim(),
            customerPhone: phone.trim(),
            customerEmail: email.trim() || undefined,
            customerAddress: needsAddress ? address.trim() : undefined,
            notes: notes.trim() || undefined,
            couponCode: couponApplied?.code,
            redeemPoints: redeemPoints > 0 ? redeemPoints : undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(t("errors.createFailed"), {
            description: json.error?.message,
          });
          return;
        }
        router.push(`/o/${json.data.token}`);
      } catch (e) {
        toast.error(t("errors.createFailed"), {
          description: e instanceof Error ? e.message : "network error",
        });
      }
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-brand-600)] py-4 text-base font-semibold text-white shadow-lg shadow-rose-200 transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        <ShoppingBag className="size-5" /> {t("buyNow")} · ฿
        {product.priceBaht.toLocaleString()}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-[color:var(--color-brand-200)] bg-white p-5 shadow-xl shadow-rose-100/40 sm:p-6"
    >
      <h2 className="font-display flex items-center gap-2 text-lg font-bold">
        <Sparkles className="size-4 text-[color:var(--color-brand-600)]" />
        {t("title")}
      </h2>
      <p className="mt-1 text-[13px] text-zinc-500">{t("subtitle")}</p>

      {/* Qty row */}
      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm font-medium">{t("qty")}</span>
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white">
          <button
            type="button"
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="grid size-9 place-items-center rounded-full text-zinc-700 hover:bg-[color:var(--color-soft)]"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-8 text-center text-sm font-semibold">{qty}</span>
          <button
            type="button"
            onClick={() => setQty(Math.min(99, qty + 1))}
            className="grid size-9 place-items-center rounded-full text-zinc-700 hover:bg-[color:var(--color-soft)]"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <FieldInput
          label={t("name")}
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={setName}
          required
          autoComplete="name"
        />
        <FieldInput
          label={t("phone")}
          placeholder={t("phonePlaceholder")}
          value={phone}
          onChange={setPhone}
          required
          autoComplete="tel"
          inputMode="numeric"
        />
        <FieldInput
          label={t("email")}
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
        />
        {needsAddress ? (
          <Field label={t("address")}>
            <textarea
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("addressPlaceholder")}
              rows={3}
              className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[15px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
            />
          </Field>
        ) : null}
        <Field label={t("notes")}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            rows={2}
            className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[15px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
          />
        </Field>
      </div>

      {/* Coupon */}
      <div className="mt-5">
        <label className="mb-1 block text-[13px] font-medium">
          <Ticket className="mr-1 inline-block size-3.5 -translate-y-0.5 text-[color:var(--color-brand-600)]" />
          รหัสคูปอง (ถ้ามี)
        </label>
        {couponApplied ? (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700 ring-1 ring-emerald-200">
            <span className="font-mono font-semibold uppercase">
              {couponApplied.code} · -฿
              {couponApplied.discountBaht.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => {
                setCouponApplied(null);
                setCouponCode("");
              }}
              className="text-[11px] font-medium text-emerald-700 underline"
            >
              เอาออก
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={couponCode}
              onChange={(e) =>
                setCouponCode(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))
              }
              placeholder="WELCOME10"
              className="font-mono uppercase"
              maxLength={40}
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={couponChecking || !couponCode.trim()}
              className={cn(
                "shrink-0 rounded-xl border border-[color:var(--color-border)] bg-white px-3 text-[13px] font-medium",
                couponChecking || !couponCode.trim()
                  ? "text-zinc-300"
                  : "text-[color:var(--color-brand-700)] hover:bg-[color:var(--color-brand-50)]",
              )}
            >
              {couponChecking ? "..." : "ใช้"}
            </button>
          </div>
        )}
      </div>

      {/* Loyalty points redemption */}
      {loyalty && loyalty.points > 0 ? (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] ring-1 ring-amber-200">
          <p className="font-medium text-amber-800">
            คุณมี {loyalty.points.toLocaleString()} คะแนนสะสม
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={Math.min(
                loyalty.points,
                Math.floor((subtotal - couponDiscount) / loyalty.bahtValuePerPoint),
              )}
              value={redeemPoints}
              onChange={(e) => setRedeemPoints(Number(e.target.value))}
              className="flex-1 accent-amber-600"
            />
            <span className="w-20 text-right text-[12px] font-semibold text-amber-800">
              ใช้ {redeemPoints} = ฿
              {(redeemPoints * loyalty.bahtValuePerPoint).toLocaleString()}
            </span>
          </div>
        </div>
      ) : null}

      <dl className="mt-5 space-y-1.5 rounded-2xl bg-[color:var(--color-soft)] px-4 py-3 text-sm">
        <Row label={t("subtotal")} value={`฿${subtotal.toLocaleString()}`} />
        {shipping > 0 ? (
          <Row label={t("shipping")} value={`฿${shipping.toLocaleString()}`} />
        ) : null}
        {couponDiscount > 0 ? (
          <Row
            label={`คูปอง ${couponApplied?.code.toUpperCase() ?? ""}`}
            value={`-฿${couponDiscount.toLocaleString()}`}
          />
        ) : null}
        {pointsDiscount > 0 ? (
          <Row
            label={`คะแนน ${redeemPoints}`}
            value={`-฿${pointsDiscount.toLocaleString()}`}
          />
        ) : null}
        <Row
          label={t("total")}
          value={`฿${total.toLocaleString()}`}
          highlight
        />
      </dl>

      <Button
        type="submit"
        size="lg"
        className="mt-5 w-full"
        loading={pending}
        disabled={pending}
      >
        {t("submit")}
      </Button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium">{label}</label>
      {children}
    </div>
  );
}

function FieldInput({
  label,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const { onChange, value, ...inputProps } = rest;
  return (
    <Field label={label}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps}
      />
    </Field>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between",
        highlight && "border-t border-[color:var(--color-border)] pt-1.5",
      )}
    >
      <dt className="text-zinc-600">{label}</dt>
      <dd
        className={cn(
          "font-semibold",
          highlight && "text-[color:var(--color-brand-700)] text-lg",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
