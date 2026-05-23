"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, ShoppingBag, Sparkles } from "lucide-react";
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

  const subtotal = product.priceBaht * qty;
  const shipping = 0; // v1: shop sets per-product shipping later
  const total = subtotal + shipping;
  const needsAddress = product.type === "PHYSICAL";

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

      <dl className="mt-5 space-y-1.5 rounded-2xl bg-[color:var(--color-soft)] px-4 py-3 text-sm">
        <Row label={t("subtotal")} value={`฿${subtotal.toLocaleString()}`} />
        {shipping > 0 ? (
          <Row label={t("shipping")} value={`฿${shipping.toLocaleString()}`} />
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
