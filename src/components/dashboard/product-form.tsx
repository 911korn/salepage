"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter, Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

type Mode = "create" | "edit";

interface ProductFormValues {
  name: string;
  slug?: string;
  description?: string | null;
  priceBaht: number;
  compareAtBaht?: number | null;
  imageUrls: string[];
  badge?: "HOT" | "NEW" | "SALE" | null;
  type: "PHYSICAL" | "DIGITAL";
  stock?: number | null;
  status?: "ACTIVE" | "HIDDEN" | "SOLD_OUT";
}

interface Props {
  mode: Mode;
  shopSlug: string;
  /** When mode="edit", the product's existing slug (used in PATCH/DELETE URL). */
  productSlug?: string;
  initialValues?: Partial<ProductFormValues>;
}

export function ProductForm({ mode, shopSlug, productSlug, initialValues }: Props) {
  const t = useTranslations("dashboard.products.form");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletePending, startDelete] = useTransition();

  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [priceBaht, setPriceBaht] = useState<string>(
    initialValues?.priceBaht !== undefined ? String(initialValues.priceBaht) : "",
  );
  const [compareAtBaht, setCompareAtBaht] = useState<string>(
    initialValues?.compareAtBaht ? String(initialValues.compareAtBaht) : "",
  );
  const [imageUrlsRaw, setImageUrlsRaw] = useState(
    (initialValues?.imageUrls ?? []).join("\n"),
  );
  const [type, setType] = useState<"PHYSICAL" | "DIGITAL">(
    initialValues?.type ?? "PHYSICAL",
  );
  const [badge, setBadge] = useState<"HOT" | "NEW" | "SALE" | "">(
    (initialValues?.badge as "HOT" | "NEW" | "SALE") ?? "",
  );
  const [stock, setStock] = useState<string>(
    initialValues?.stock !== undefined && initialValues.stock !== null
      ? String(initialValues.stock)
      : "",
  );
  const [status, setStatus] = useState<"ACTIVE" | "HIDDEN" | "SOLD_OUT">(
    initialValues?.status ?? "ACTIVE",
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("errors.nameRequired"));
      return;
    }
    const price = Number(priceBaht);
    if (!price || price <= 0) {
      toast.error(t("errors.priceRequired"));
      return;
    }
    startTransition(async () => {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        priceBaht: price,
        compareAtBaht: compareAtBaht ? Number(compareAtBaht) : undefined,
        imageUrls: imageUrlsRaw
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 10),
        type,
        badge: badge || null,
        stock: stock ? Number(stock) : null,
        ...(mode === "edit" ? { status } : {}),
      };
      try {
        const url =
          mode === "create"
            ? `/api/v1/shops/${shopSlug}/products`
            : `/api/v1/shops/${shopSlug}/products/${productSlug}`;
        const res = await fetch(url, {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(
            mode === "create" ? t("errors.createFailed") : t("errors.updateFailed"),
            { description: json.error?.message },
          );
          return;
        }
        toast.success(mode === "create" ? t("submitNew") : t("submit"));
        router.push("/dashboard/products");
        router.refresh();
      } catch (e) {
        toast.error(t("errors.createFailed"), {
          description: e instanceof Error ? e.message : "network error",
        });
      }
    });
  }

  function onDelete() {
    if (!productSlug) return;
    if (!confirm(t("deleteConfirm"))) return;
    startDelete(async () => {
      try {
        const res = await fetch(
          `/api/v1/shops/${shopSlug}/products/${productSlug}`,
          { method: "DELETE" },
        );
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(json.error?.message ?? "delete failed");
          return;
        }
        toast.success(t("deleted"));
        router.push("/dashboard/products");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "delete error");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-3xl space-y-6"
    >
      <header className="flex items-center gap-3">
        <Link
          href="/dashboard/products"
          className="grid size-9 place-items-center rounded-lg border border-[color:var(--color-border)] bg-white hover:bg-[color:var(--color-soft)]"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="font-display text-xl font-bold sm:text-2xl">
          {mode === "create" ? t("createTitle") : t("editTitle")}
        </h1>
      </header>

      <div className="space-y-5 rounded-3xl border border-[color:var(--color-border)] bg-white p-6 shadow-sm sm:p-7">
        <Field label={t("nameLabel")}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={120}
            required
          />
        </Field>

        <Field label={t("descLabel")}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descPlaceholder")}
            rows={4}
            maxLength={2000}
            className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[15px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("priceLabel")}>
            <Input
              type="number"
              min={1}
              max={9999999}
              value={priceBaht}
              onChange={(e) => setPriceBaht(e.target.value)}
              prefix={<span className="font-semibold">฿</span>}
              required
            />
          </Field>
          <Field label={t("compareAtLabel")} hint={t("compareAtHint")}>
            <Input
              type="number"
              min={1}
              max={9999999}
              value={compareAtBaht}
              onChange={(e) => setCompareAtBaht(e.target.value)}
              prefix={<span className="font-semibold">฿</span>}
            />
          </Field>
        </div>

        <Field label={t("imagesLabel")} hint={t("imagesHint")}>
          <textarea
            value={imageUrlsRaw}
            onChange={(e) => setImageUrlsRaw(e.target.value)}
            placeholder={t("imagesPlaceholder")}
            rows={3}
            className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 font-mono text-[13px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("typeLabel")}>
            <div className="grid grid-cols-2 gap-2">
              <ToggleBtn
                active={type === "PHYSICAL"}
                onClick={() => setType("PHYSICAL")}
                label={t("typePhysical")}
              />
              <ToggleBtn
                active={type === "DIGITAL"}
                onClick={() => setType("DIGITAL")}
                label={t("typeDigital")}
              />
            </div>
          </Field>

          <Field label={t("badgeLabel")}>
            <div className="flex flex-wrap gap-2">
              {(["", "HOT", "NEW", "SALE"] as const).map((b) => (
                <ToggleBtn
                  key={b || "none"}
                  active={badge === b}
                  onClick={() => setBadge(b)}
                  label={
                    b === ""
                      ? t("badgeNone")
                      : b === "HOT"
                        ? t("badgeHot")
                        : b === "NEW"
                          ? t("badgeNew")
                          : t("badgeSale")
                  }
                />
              ))}
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("stockLabel")} hint={t("stockHint")}>
            <Input
              type="number"
              min={0}
              max={99999}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="-"
            />
          </Field>

          {mode === "edit" ? (
            <Field label={t("statusLabel")}>
              <div className="flex flex-wrap gap-2">
                <ToggleBtn
                  active={status === "ACTIVE"}
                  onClick={() => setStatus("ACTIVE")}
                  label={t("statusActive")}
                />
                <ToggleBtn
                  active={status === "HIDDEN"}
                  onClick={() => setStatus("HIDDEN")}
                  label={t("statusHidden")}
                />
                <ToggleBtn
                  active={status === "SOLD_OUT"}
                  onClick={() => setStatus("SOLD_OUT")}
                  label={t("statusSoldOut")}
                />
              </div>
            </Field>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        {mode === "edit" ? (
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={onDelete}
            loading={deletePending}
            disabled={deletePending}
          >
            <Trash2 className="size-4" /> {t("delete")}
          </Button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/products"
            className={cn(
              "rounded-xl border border-[color:var(--color-border)] bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50",
            )}
          >
            {t("cancel")}
          </Link>
          <Button type="submit" loading={pending} disabled={pending}>
            <Save className="size-4" />
            {mode === "create" ? t("submitNew") : t("submit")}
          </Button>
        </div>
      </div>
    </form>
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

function ToggleBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "border-[color:var(--color-brand-600)] bg-[color:var(--color-brand-600)] text-white"
          : "border-[color:var(--color-border)] bg-white text-zinc-700 hover:border-[color:var(--color-brand-300)] hover:bg-[color:var(--color-brand-50)]",
      )}
    >
      {label}
    </button>
  );
}

// suppress unused export warning if Badge isn't used here yet
void Badge;
