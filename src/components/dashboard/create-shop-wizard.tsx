"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { dashboardHref } from "@/lib/dashboard-routing";
import { storefrontLabel } from "@/lib/storefront-url";

type CategoryKey =
  | "fashion"
  | "food"
  | "tech"
  | "beauty"
  | "health"
  | "furniture"
  | "pets"
  | "books"
  | "sport"
  | "other";

const CATEGORIES: CategoryKey[] = [
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
];

const THEME_PRESETS = [
  { color: "#e11d48", name: "Brand red" },
  { color: "#0f172a", name: "Midnight" },
  { color: "#2563eb", name: "Blue" },
  { color: "#16a34a", name: "Green" },
  { color: "#7c3aed", name: "Violet" },
  { color: "#ec4899", name: "Pink" },
  { color: "#d97706", name: "Amber" },
  { color: "#52525b", name: "Zinc" },
];

const STEPS = 3;

// Collapse anything outside [a-z0-9] into a single hyphen, trim ends, clamp to
// 40 chars. (Earlier version used `[^ -]+` which was a buggy character class
// meaning "not space and not hyphen" — it stripped every letter the user
// typed and made the slug input look broken. Fixed 2026-05-23.)
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateShopWizard() {
  const t = useTranslations("dashboard.createShop");
  const locale = useLocale() as "th" | "en";
  const tCategory = useTranslations("categories");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  // The slug input is "lenient" — we let the user type anything they want
  // (including Thai) so the field always echoes their keystrokes. The
  // `effectiveSlug` used by the API is computed by slugifying it on read.
  //
  // Earlier we ran `slugify` inside the onChange handler, which silently
  // dropped any non-ASCII the user typed → the input looked broken on Thai
  // keyboards. Storing raw input + slugifying on read fixes that.
  const [slugInputRaw, setSlugInputRaw] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const slugDisplay = slugDirty ? slugInputRaw : slugify(name);
  const effectiveSlug = slugify(slugDirty ? slugInputRaw : name);

  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [themeColor, setThemeColor] = useState(THEME_PRESETS[0].color);
  const [promptpayId, setPromptpayId] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [facebook, setFacebook] = useState("");

  const canNext = useMemo(() => {
    if (step === 1) return name.trim().length >= 2 && effectiveSlug.length >= 3;
    if (step === 2) return Boolean(category);
    if (step === 3) return Boolean(promptpayId.trim() || phone.trim());
    return false;
  }, [step, name, effectiveSlug, category, promptpayId, phone]);

  function next() {
    if (!canNext) return;
    if (step < STEPS) setStep(step + 1);
  }
  function back() {
    if (step > 1) setStep(step - 1);
  }

  function submit() {
    if (!canNext) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/shops", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            slug: effectiveSlug,
            category,
            themeColor,
            promptpayId: promptpayId.trim() || undefined,
            contact: {
              phone: phone.trim() || undefined,
              line: lineId.trim() || undefined,
              facebook: facebook.trim() || undefined,
            },
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(t("errors.createFailed"), {
            description: json.error?.message,
          });
          return;
        }
        toast.success(t("successTitle"), {
          description: t("successDesc", {
            url: storefrontLabel(json.data.shop.slug),
          }),
        });
        router.push(dashboardHref("/dashboard", json.data.shop.slug));
        router.refresh();
      } catch (e) {
        toast.error(t("errors.createFailed"), {
          description: e instanceof Error ? e.message : "network error",
        });
      }
    });
  }

  return (
    <div className="rounded-3xl border border-[color:var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold sm:text-2xl">
          {t("title")}
        </h1>
        <Badge tone="soft-brand" className="text-[11px]">
          {t("step", { n: step, total: STEPS })}
        </Badge>
      </header>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {Array.from({ length: STEPS }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-colors",
              i + 1 <= step
                ? "bg-[color:var(--color-brand-600)]"
                : "bg-[color:var(--color-border)]",
            )}
          />
        ))}
      </div>

      <div className="mt-6 space-y-5">
        {step === 1 ? (
          <Step1
            t={t}
            name={name}
            slugDisplay={slugDisplay}
            slugPreview={effectiveSlug}
            onName={setName}
            onSlug={(v) => {
              setSlugInputRaw(v);
              setSlugDirty(true);
            }}
          />
        ) : null}
        {step === 2 ? (
          <Step2
            t={t}
            tCategory={tCategory}
            categories={CATEGORIES}
            category={category}
            onCategory={setCategory}
            themeColor={themeColor}
            onTheme={setThemeColor}
            locale={locale}
          />
        ) : null}
        {step === 3 ? (
          <Step3
            t={t}
            promptpayId={promptpayId}
            onPromptpayId={setPromptpayId}
            phone={phone}
            onPhone={setPhone}
            lineId={lineId}
            onLineId={setLineId}
            facebook={facebook}
            onFacebook={setFacebook}
          />
        ) : null}
      </div>

      <footer className="mt-7 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="md"
          onClick={back}
          disabled={step === 1 || pending}
        >
          <ArrowLeft className="size-4" /> {t("back")}
        </Button>
        {step < STEPS ? (
          <Button onClick={next} disabled={!canNext} size="md">
            {t("next")} <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={submit}
            loading={pending}
            disabled={!canNext || pending}
            size="md"
          >
            <Sparkles className="size-4" /> {t("submit")}
          </Button>
        )}
      </footer>
    </div>
  );
}

function Step1({
  t,
  name,
  slugDisplay,
  slugPreview,
  onName,
  onSlug,
}: {
  t: ReturnType<typeof useTranslations<"dashboard.createShop">>;
  name: string;
  /** What to display in the slug input field (raw user keystrokes). */
  slugDisplay: string;
  /** Normalized URL-safe slug shown as preview below. */
  slugPreview: string;
  onName: (v: string) => void;
  onSlug: (v: string) => void;
}) {
  const needsNormalization =
    slugDisplay.length > 0 && slugDisplay !== slugPreview;
  return (
    <>
      <div>
        <h2 className="font-display text-base font-semibold">
          {t("step1Title")}
        </h2>
        <p className="mt-1 text-[13px] text-zinc-500">{t("step1Desc")}</p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("nameLabel")}
        </label>
        <Input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={t("namePlaceholder")}
          className="h-12"
          autoFocus
          maxLength={60}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("slugLabel")}
        </label>
        <Input
          prefix={<span className="text-xs">salepage.in.th/</span>}
          value={slugDisplay}
          onChange={(e) => onSlug(e.target.value)}
          placeholder="my-shop"
          className="h-12"
          maxLength={60}
        />
        {needsNormalization ? (
          <p className="mt-1.5 text-xs text-amber-700">
            → จะกลายเป็น{" "}
            <code className="font-mono text-[11px] font-semibold">
              {storefrontLabel(slugPreview || "?")}
            </code>{" "}
            (รองรับเฉพาะ a-z, 0-9, ขีดกลาง)
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-zinc-500">{t("slugHint")}</p>
        )}
      </div>
    </>
  );
}

function Step2({
  t,
  tCategory,
  categories,
  category,
  onCategory,
  themeColor,
  onTheme,
  locale,
}: {
  t: ReturnType<typeof useTranslations<"dashboard.createShop">>;
  tCategory: ReturnType<typeof useTranslations<"categories">>;
  categories: CategoryKey[];
  category: CategoryKey | null;
  onCategory: (c: CategoryKey) => void;
  themeColor: string;
  onTheme: (c: string) => void;
  locale: "th" | "en";
}) {
  void locale;
  return (
    <>
      <div>
        <h2 className="font-display text-base font-semibold">
          {t("step2Title")}
        </h2>
        <p className="mt-1 text-[13px] text-zinc-500">{t("step2Desc")}</p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">
          {t("categoryLabel")}
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                category === c
                  ? "border-[color:var(--color-brand-600)] bg-[color:var(--color-brand-600)] text-white"
                  : "border-[color:var(--color-border)] bg-white text-zinc-700 hover:border-[color:var(--color-brand-300)] hover:bg-[color:var(--color-brand-50)]",
              )}
            >
              {tCategory(c)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">
          {t("themeLabel")}
        </label>
        <div className="grid grid-cols-8 gap-2">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.color}
              type="button"
              onClick={() => onTheme(p.color)}
              title={p.name}
              className={cn(
                "relative grid aspect-square place-items-center rounded-xl transition-transform",
                themeColor === p.color
                  ? "scale-105 ring-2 ring-offset-2 ring-[color:var(--color-brand-600)]"
                  : "hover:scale-105",
              )}
              style={{ background: p.color }}
            >
              {themeColor === p.color ? (
                <Check className="size-4 text-white" strokeWidth={3} />
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function Step3({
  t,
  promptpayId,
  onPromptpayId,
  phone,
  onPhone,
  lineId,
  onLineId,
  facebook,
  onFacebook,
}: {
  t: ReturnType<typeof useTranslations<"dashboard.createShop">>;
  promptpayId: string;
  onPromptpayId: (v: string) => void;
  phone: string;
  onPhone: (v: string) => void;
  lineId: string;
  onLineId: (v: string) => void;
  facebook: string;
  onFacebook: (v: string) => void;
}) {
  return (
    <>
      <div>
        <h2 className="font-display text-base font-semibold">
          {t("step3Title")}
        </h2>
        <p className="mt-1 text-[13px] text-zinc-500">{t("step3Desc")}</p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t("promptpayLabel")}
          </label>
          <Input
            value={promptpayId}
            onChange={(e) => onPromptpayId(e.target.value)}
            placeholder="0812345678"
            inputMode="numeric"
            className="h-12"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t("phoneLabel")}
          </label>
          <Input
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            placeholder="08x-xxx-xxxx"
            inputMode="numeric"
            className="h-12"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t("lineLabel")}
          </label>
          <Input
            value={lineId}
            onChange={(e) => onLineId(e.target.value)}
            placeholder="@yourshop"
            className="h-12"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t("facebookLabel")}
          </label>
          <Input
            value={facebook}
            onChange={(e) => onFacebook(e.target.value)}
            placeholder="https://facebook.com/yourpage"
            className="h-12"
          />
        </div>
      </div>
    </>
  );
}
