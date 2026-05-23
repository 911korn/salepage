"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, QrCode, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type PlanId = "free" | "starter" | "pro" | "business" | "agency";
type PaidPlan = Exclude<PlanId, "free">;
type Period = "month" | "year";

interface PlanConfig {
  id: PlanId;
  monthlyPrice: number; // baht
  highlight: boolean;
}

const PLANS: PlanConfig[] = [
  { id: "free", monthlyPrice: 0, highlight: false },
  { id: "starter", monthlyPrice: 199, highlight: false },
  { id: "pro", monthlyPrice: 399, highlight: true },
  { id: "business", monthlyPrice: 990, highlight: false },
  { id: "agency", monthlyPrice: 2990, highlight: false },
];

const CREDIT_PACKS = [
  { slips: 50, priceBaht: 49 },
  { slips: 150, priceBaht: 129 },
  { slips: 500, priceBaht: 399 },
  { slips: 1500, priceBaht: 990 },
  { slips: 5000, priceBaht: 2900 },
];

export function Pricing() {
  const t = useTranslations("pricing");
  const tCommon = useTranslations("common");
  const tBilling = useTranslations("billing");
  const locale = useLocale() as "th" | "en";
  const [period, setPeriod] = useState<Period>("year");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function startCheckout(
    plan: PaidPlan,
    method: "card" | "promptpay",
  ) {
    // PromptPay is annual-only — Stripe handles monthly via card subscription.
    // The toggle still drives the card flow but PromptPay always pays a year.
    const effectivePeriod: Period = method === "promptpay" ? "year" : period;
    const key = `${plan}-${method}-${effectivePeriod}`;
    setLoadingKey(key);
    try {
      const url =
        method === "card"
          ? "/api/v1/billing/checkout"
          : "/api/v1/billing/checkout-once";
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, period: effectivePeriod, locale }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(tBilling("errorTitle"), {
          description: json.error?.message ?? `HTTP ${res.status}`,
        });
        return;
      }
      window.location.href = json.data.url;
    } catch (e) {
      toast.error(tBilling("errorTitle"), {
        description: e instanceof Error ? e.message : "network error",
      });
    } finally {
      setLoadingKey(null);
    }
  }

  function priceDisplay(plan: PlanConfig) {
    if (plan.monthlyPrice === 0) return { primary: "฿0", suffix: t("lifetime") };
    if (period === "year") {
      const yearly = plan.monthlyPrice * 10;
      return {
        primary: `฿${yearly.toLocaleString()}`,
        suffix: t("perYear"),
      };
    }
    return {
      primary: `฿${plan.monthlyPrice.toLocaleString()}`,
      suffix: t("perMonth"),
    };
  }

  return (
    <section id="pricing" className="py-20 sm:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="soft-brand">
            <Sparkles className="size-3.5" /> {t("tagline")}
          </Badge>
          <h2 className="font-display mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t("title1")} <br className="hidden sm:block" />
            <span className="text-[color:var(--color-brand-600)]">
              {t("titleHighlight")}
            </span>
          </h2>
          <p className="mt-4 text-balance text-[17px] leading-relaxed text-zinc-600">
            {t("desc")}
          </p>
        </div>

        {/* Monthly/Yearly toggle — default yearly so users see the savings */}
        <div className="mt-8 flex justify-center">
          <div
            role="tablist"
            aria-label="Billing period"
            className="inline-flex rounded-full border border-[color:var(--color-border)] bg-white p-1 shadow-sm"
          >
            <PeriodTab
              active={period === "month"}
              onClick={() => setPeriod("month")}
              label={t("toggle.monthly")}
            />
            <PeriodTab
              active={period === "year"}
              onClick={() => setPeriod("year")}
              label={t("toggle.yearly")}
              badge={t("toggle.saveBadge")}
            />
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5 lg:gap-3">
          {PLANS.map((p, i) => {
            const features = t.raw(`plans.${p.id}.features`) as string[];
            const price = priceDisplay(p);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className={cn(
                  "relative flex flex-col rounded-3xl border bg-white p-5 transition-shadow",
                  p.highlight
                    ? "border-[color:var(--color-brand-300)] shadow-xl shadow-rose-100/60 lg:scale-[1.04] lg:z-10"
                    : "border-[color:var(--color-border)] shadow-sm",
                )}
              >
                {p.highlight ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--color-brand-600)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-md">
                    {t("popular")}
                  </span>
                ) : null}

                <div>
                  <h3 className="font-display text-lg font-bold">
                    {t(`plans.${p.id}.name`)}
                  </h3>
                  <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[12.5px] text-zinc-600">
                    {t(`plans.${p.id}.desc`)}
                  </p>
                </div>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "font-display text-3xl font-bold sm:text-[2rem]",
                      p.highlight && "text-[color:var(--color-brand-600)]",
                    )}
                  >
                    {price.primary}
                  </span>
                  <span className="text-[12px] text-zinc-500">
                    {price.suffix}
                  </span>
                </div>
                {p.monthlyPrice > 0 && period === "year" ? (
                  <p className="-mt-1 text-[11px] text-emerald-700">
                    ≈ ฿{p.monthlyPrice.toLocaleString()}{t("perMonth")} ·{" "}
                    {t("toggle.saveBadge")}
                  </p>
                ) : null}

                {p.id === "free" ? (
                  <Link
                    href="/signup"
                    className={cn(
                      buttonStyles({ size: "md", variant: "outline" }),
                      "mt-5 w-full",
                    )}
                  >
                    {t(`plans.${p.id}.cta`)}
                  </Link>
                ) : (
                  <>
                    <Button
                      size="md"
                      variant={p.highlight ? "primary" : "outline"}
                      className="mt-5 w-full"
                      loading={loadingKey === `${p.id}-card-${period}`}
                      onClick={() => startCheckout(p.id as PaidPlan, "card")}
                    >
                      {loadingKey === `${p.id}-card-${period}`
                        ? tBilling("loading")
                        : t(`plans.${p.id}.cta`)}
                    </Button>
                    {period === "year" ? (
                      <button
                        type="button"
                        onClick={() =>
                          startCheckout(p.id as PaidPlan, "promptpay")
                        }
                        disabled={loadingKey === `${p.id}-promptpay-year`}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-[12px] font-medium text-zinc-700 transition-colors hover:border-[color:var(--color-brand-300)] hover:bg-[color:var(--color-brand-50)] disabled:opacity-50"
                      >
                        <QrCode className="size-3.5 text-[color:var(--color-brand-600)]" />
                        {loadingKey === `${p.id}-promptpay-year`
                          ? tBilling("loading")
                          : "จ่ายด้วย PromptPay"}
                      </button>
                    ) : (
                      <p className="mt-2 text-center text-[11px] text-zinc-500">
                        💡 ใช้ PromptPay ได้เมื่อเลือกรายปี
                      </p>
                    )}
                  </>
                )}

                <ul className="mt-5 flex-1 space-y-2 text-[12.5px]">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check
                        className={cn(
                          "mt-0.5 size-3.5 shrink-0",
                          p.highlight
                            ? "text-[color:var(--color-brand-600)]"
                            : "text-emerald-600",
                        )}
                      />
                      <span className="text-zinc-700">{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Guarantees row */}
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <Guarantee icon={ShieldCheck} text={t("guarantees.noCommission")} />
          <Guarantee icon={ShieldCheck} text={t("guarantees.noFee")} />
          <Guarantee icon={Wallet} text={t("guarantees.direct")} />
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {t("footnote")}
        </p>

        {/* AI slip credit packs */}
        <section className="mt-16">
          <div className="mx-auto max-w-2xl text-center">
            <Badge tone="soft-brand">
              <QrCode className="size-3.5" /> {t("credits.title")}
            </Badge>
            <h3 className="font-display mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("credits.title")}
            </h3>
            <p className="mt-3 text-balance text-[15px] leading-relaxed text-zinc-600">
              {t("credits.subtitle")}
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.slips}
                className="rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-center"
              >
                <p className="font-display text-xl font-bold">
                  {pack.slips.toLocaleString()}
                </p>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                  สลิป
                </p>
                <p className="font-display mt-2 text-lg font-bold text-[color:var(--color-brand-700)]">
                  ฿{pack.priceBaht.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  ฿{(pack.priceBaht / pack.slips).toFixed(2)}/สลิป
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[12px] text-zinc-500">
            {t("credits.footnote")}
          </p>
        </section>
      </div>
    </section>
  );
}

function PeriodTab({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative rounded-full px-5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-[color:var(--color-brand-600)] text-white shadow-sm"
          : "text-zinc-700 hover:text-[color:var(--color-fg)]",
      )}
    >
      {label}
      {badge ? (
        <span
          className={cn(
            "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            active
              ? "bg-white/20 text-white"
              : "bg-emerald-100 text-emerald-700",
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function Guarantee({
  icon: Icon,
  text,
}: {
  icon: typeof ShieldCheck;
  text: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3">
      <Icon className="size-4 text-emerald-600" />
      <span className="text-sm font-medium text-zinc-700">{text}</span>
    </div>
  );
}
