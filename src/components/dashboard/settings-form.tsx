"use client";

import { useState, useTransition } from "react";
import { Check, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface ShopProps {
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  themeColor: string;
  logoText: string | null;
  promptpayId: string | null;
  contact: { phone?: string; line?: string; facebook?: string } | null;
  policies: { returnPolicy?: string; shippingTime?: string } | null;
}

const CATEGORIES = [
  "fashion",
  "food",
  "tech",
  "beauty",
  "health",
  "furniture",
  "pets",
  "books",
  "sport",
  "other",
] as const;

const THEME_PRESETS = [
  "#e11d48",
  "#0f172a",
  "#2563eb",
  "#16a34a",
  "#7c3aed",
  "#ec4899",
  "#d97706",
  "#52525b",
];

export function SettingsForm({ shop }: { shop: ShopProps }) {
  const t = useTranslations("dashboard.settings");
  const tCat = useTranslations("categories");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(shop.name);
  const [description, setDescription] = useState(shop.description ?? "");
  const [category, setCategory] = useState<string | null>(shop.category);
  const [themeColor, setThemeColor] = useState(shop.themeColor);
  const [logoText, setLogoText] = useState(shop.logoText ?? "");
  const [promptpayId, setPromptpayId] = useState(shop.promptpayId ?? "");
  const [phone, setPhone] = useState(shop.contact?.phone ?? "");
  const [line, setLine] = useState(shop.contact?.line ?? "");
  const [facebook, setFacebook] = useState(shop.contact?.facebook ?? "");
  const [returnPolicy, setReturnPolicy] = useState(
    shop.policies?.returnPolicy ?? "",
  );
  const [shippingTime, setShippingTime] = useState(
    shop.policies?.shippingTime ?? "",
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/shops/${shop.slug}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            category: category ?? null,
            themeColor,
            logoText: logoText.trim() || null,
            promptpayId: promptpayId.trim() || null,
            contact: {
              phone: phone.trim() || null,
              line: line.trim() || null,
              facebook: facebook.trim() || null,
            },
            policies: {
              returnPolicy: returnPolicy.trim() || null,
              shippingTime: shippingTime.trim() || null,
            },
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(t("errors.saveFailed"), {
            description: json.error?.message,
          });
          return;
        }
        toast.success(t("saved"));
        router.refresh();
      } catch (e) {
        toast.error(t("errors.saveFailed"), {
          description: e instanceof Error ? e.message : "network error",
        });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* General */}
      <Card title={t("sections.general")}>
        <Field label={t("fields.name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t("fields.description")}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={280}
            className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[15px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
          />
        </Field>
        <Field label={t("fields.category")}>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(category === c ? null : c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  category === c
                    ? "border-[color:var(--color-brand-600)] bg-[color:var(--color-brand-600)] text-white"
                    : "border-[color:var(--color-border)] bg-white text-zinc-700 hover:border-[color:var(--color-brand-300)]",
                )}
              >
                {tCat(c)}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.themeColor")}>
            <div className="flex flex-wrap items-center gap-2">
              {THEME_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setThemeColor(c)}
                  className={cn(
                    "grid size-9 place-items-center rounded-xl transition-transform",
                    themeColor === c
                      ? "scale-105 ring-2 ring-offset-2 ring-[color:var(--color-brand-600)]"
                      : "hover:scale-105",
                  )}
                  style={{ background: c }}
                >
                  {themeColor === c ? (
                    <Check className="size-4 text-white" strokeWidth={3} />
                  ) : null}
                </button>
              ))}
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="size-9 cursor-pointer rounded-xl border-2 border-[color:var(--color-border)]"
                title="Custom"
              />
            </div>
          </Field>
          <Field label={t("fields.logoText")} hint={t("fields.logoHint")}>
            <Input
              value={logoText}
              onChange={(e) => setLogoText(e.target.value.slice(0, 2))}
              maxLength={2}
              placeholder={name.slice(0, 1).toUpperCase()}
            />
          </Field>
        </div>
      </Card>

      {/* Payment */}
      <Card title={t("sections.payment")}>
        <Field label={t("fields.promptpayId")} hint={t("fields.promptpayHint")}>
          <Input
            value={promptpayId}
            onChange={(e) => setPromptpayId(e.target.value)}
            placeholder="0812345678"
            inputMode="numeric"
          />
        </Field>
      </Card>

      {/* Contact */}
      <Card title={t("sections.contact")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.phone")}>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08x-xxx-xxxx"
              inputMode="numeric"
            />
          </Field>
          <Field label={t("fields.line")}>
            <Input
              value={line}
              onChange={(e) => setLine(e.target.value)}
              placeholder="@yourshop"
            />
          </Field>
        </div>
        <Field label={t("fields.facebook")}>
          <Input
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="https://facebook.com/yourpage"
            type="url"
          />
        </Field>
      </Card>

      {/* Policies */}
      <Card title={t("sections.policies")}>
        <Field label={t("fields.returnPolicy")}>
          <textarea
            value={returnPolicy}
            onChange={(e) => setReturnPolicy(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[15px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
          />
        </Field>
        <Field label={t("fields.shippingTime")}>
          <Input
            value={shippingTime}
            onChange={(e) => setShippingTime(e.target.value)}
            placeholder="1-3 วันทำการ"
          />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={pending}>
          <Save className="size-4" /> {t("save")}
        </Button>
      </div>
    </form>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-5 sm:p-7">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
