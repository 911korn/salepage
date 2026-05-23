"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Heart, Sparkles, ShieldCheck, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { storefrontPath } from "@/lib/storefront-url";

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

// Keep keys + slips + price-baht in sync with src/lib/slip-credits.ts SLIP_PACKS.
const CREDIT_PACKS = [
  { key: "p50", slips: 50, priceBaht: 49 },
  { key: "p150", slips: 150, priceBaht: 129 },
  { key: "p500", slips: 500, priceBaht: 399 },
  { key: "p1500", slips: 1500, priceBaht: 990 },
  { key: "p5000", slips: 5000, priceBaht: 2900 },
] as const;
type CreditPackKey = (typeof CREDIT_PACKS)[number]["key"];

export function Pricing() {
  const t = useTranslations("pricing");
  const tBilling = useTranslations("billing");
  const locale = useLocale() as "th" | "en";
  // Default ON (yearly) so the discount is the first thing users see, à la Submagic.
  const [yearly, setYearly] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<CreditPackKey | null>(null);
  const [shopPicker, setShopPicker] = useState<{
    pack: CreditPackKey;
    shops: { slug: string; name: string }[];
  } | null>(null);

  const period: Period = yearly ? "year" : "month";

  async function startCreditCheckout(pack: CreditPackKey, shopSlug?: string) {
    setLoadingPack(pack);
    try {
      if (!shopSlug) {
        // Resolve the buyer's shops first.
        const shopsRes = await fetch("/api/v1/shops");
        if (shopsRes.status === 401) {
          window.location.href = `/signin?callbackUrl=${encodeURIComponent("/#pricing")}`;
          return;
        }
        const shopsJson = (await shopsRes.json()) as {
          ok: boolean;
          data?: { shops: { slug: string; name: string }[] };
        };
        const shops = shopsJson.data?.shops ?? [];
        if (shops.length === 0) {
          toast.error("สร้างร้านก่อน แล้วจึงซื้อ slip credits ได้");
          window.location.href = "/dashboard/create-shop";
          return;
        }
        if (shops.length > 1) {
          // Open picker — user clicks a shop, picker callback re-enters
          // this function with shopSlug set.
          setShopPicker({
            pack,
            shops: shops.map((s) => ({ slug: s.slug, name: s.name })),
          });
          return;
        }
        shopSlug = shops[0].slug;
      }

      const res = await fetch("/api/v1/billing/checkout-credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pack, shopSlug, locale }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { url?: string };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data?.url) {
        toast.error(json.error?.message ?? "เปิดหน้าซื้อไม่สำเร็จ");
        return;
      }
      window.location.assign(json.data.url);
    } finally {
      setLoadingPack(null);
      setShopPicker(null);
    }
  }

  async function startCheckout(plan: PaidPlan) {
    setLoadingPlan(plan);
    try {
      // Yearly → mode:payment one-time (Stripe shows Card + PromptPay on the
      // hosted page; webhook extends Subscription by 365d).
      // Monthly → mode:subscription Card auto-renew.
      const url =
        period === "year"
          ? "/api/v1/billing/checkout-once"
          : "/api/v1/billing/checkout";
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, period, locale }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(tBilling("errorTitle"), {
          description: json.error?.message ?? `HTTP ${res.status}`,
        });
        return;
      }
      window.location.assign(json.data.url);
    } catch (e) {
      toast.error(tBilling("errorTitle"), {
        description: e instanceof Error ? e.message : "network error",
      });
    } finally {
      setLoadingPlan(null);
    }
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

        {/* iOS-style yearly toggle — default ON so the 17% saving is the first read */}
        <div className="mt-10 flex items-center justify-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-2 text-[15px] transition-colors",
              yearly ? "font-semibold text-zinc-900" : "text-zinc-500",
            )}
          >
            {t("toggle.yearly")}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider transition-opacity",
                yearly
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-zinc-100 text-zinc-400",
              )}
            >
              {t("toggle.saveBadge")}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={yearly}
            onClick={() => setYearly((v) => !v)}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
              yearly
                ? "bg-[color:var(--color-brand-600)]"
                : "bg-zinc-200",
            )}
          >
            <span className="sr-only">Toggle annual billing</span>
            <span
              className={cn(
                "inline-block size-5 transform rounded-full bg-white shadow-md transition-transform",
                yearly ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
          <span
            className={cn(
              "text-[15px] transition-colors",
              yearly ? "text-zinc-500" : "font-semibold text-zinc-900",
            )}
          >
            {t("toggle.monthly")}
          </span>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5 lg:gap-3">
          {PLANS.map((p, i) => {
            const features = t.raw(`plans.${p.id}.features`) as string[];
            const isFree = p.monthlyPrice === 0;
            const yearlyTotal = p.monthlyPrice * 10;
            // Submagic pattern: when yearly is ON, headline shows the effective
            // monthly rate (annual total / 12) — it drops because 2 months are
            // free. Pro ฿399 → ฿333/mo, Business ฿990 → ฿825/mo, etc.
            const effectiveMonthly = yearly
              ? Math.round(yearlyTotal / 12)
              : p.monthlyPrice;
            const monthlyDisplay = isFree
              ? "฿0"
              : `฿${effectiveMonthly.toLocaleString()}`;
            const isLoading = loadingPlan === p.id;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className={cn(
                  "relative flex flex-col rounded-3xl border bg-white p-5 transition-shadow",
                  p.highlight
                    ? "border-2 border-[color:var(--color-brand-500)] shadow-xl shadow-rose-100/60 lg:scale-[1.04] lg:z-10"
                    : "border-[color:var(--color-border)] shadow-sm",
                )}
              >
                {p.highlight ? (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[color:var(--color-brand-600)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-md">
                    <Heart className="size-3 fill-current" /> {t("popular")}
                  </span>
                ) : null}

                <div>
                  <h3 className="font-display text-lg font-bold uppercase tracking-wide">
                    {t(`plans.${p.id}.name`)}
                  </h3>
                  <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[12.5px] leading-snug text-zinc-600">
                    {t(`plans.${p.id}.desc`)}
                  </p>
                </div>

                {/* Headline price — always per-month equivalent */}
                <div className="mt-4">
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "font-display text-3xl font-bold sm:text-[2rem]",
                        p.highlight && "text-[color:var(--color-brand-600)]",
                      )}
                    >
                      {monthlyDisplay}
                    </span>
                    <span className="text-[12px] text-zinc-500">
                      {isFree ? t("lifetime") : t("perMonth")}
                    </span>
                  </div>
                  {/* Billing-cadence subline */}
                  {!isFree ? (
                    <p className="mt-1 text-[11.5px] text-zinc-500">
                      {yearly
                        ? `ชำระรายปี ฿${yearlyTotal.toLocaleString()}`
                        : "ชำระรายเดือน auto-renew"}
                    </p>
                  ) : null}
                  {/* Save badge — only on yearly */}
                  {!isFree && yearly ? (
                    <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-emerald-700">
                      ประหยัด ฿{(p.monthlyPrice * 2).toLocaleString()}/ปี
                    </span>
                  ) : null}
                </div>

                {/* One CTA per card */}
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
                  <Button
                    size="md"
                    variant={p.highlight ? "primary" : "outline"}
                    className="mt-5 w-full"
                    loading={isLoading}
                    onClick={() => startCheckout(p.id as PaidPlan)}
                  >
                    {isLoading
                      ? tBilling("loading")
                      : t(`plans.${p.id}.cta`)}
                  </Button>
                )}

                {/* Payment method hint */}
                {!isFree ? (
                  <p className="mt-2 text-center text-[10.5px] text-zinc-400">
                    {yearly
                      ? "Card หรือ PromptPay"
                      : "บัตรเครดิตเท่านั้น (auto-renew)"}
                  </p>
                ) : null}

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
            <h3 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {t("credits.title")}
            </h3>
            <p className="mt-3 text-balance text-[15px] leading-relaxed text-zinc-600">
              {t("credits.subtitle")}
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CREDIT_PACKS.map((pack) => {
              const loading = loadingPack === pack.key;
              return (
                <div
                  key={pack.key}
                  className="flex flex-col rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-center"
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    loading={loading}
                    onClick={() => startCreditCheckout(pack.key)}
                  >
                    ซื้อ
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-[12px] text-zinc-500">
            {t("credits.footnote")}
          </p>
        </section>

        {/* Shop-picker modal — only shown when the buyer has 2+ shops */}
        {shopPicker ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
              <h4 className="font-display text-lg font-bold">
                เติมเครดิตให้ร้านไหน?
              </h4>
              <p className="mt-1 text-[12px] text-zinc-600">
                เลือกร้านที่อยากเติม{" "}
                {CREDIT_PACKS.find((p) => p.key === shopPicker.pack)?.slips.toLocaleString()}{" "}
                สลิป
              </p>
              <ul className="mt-3 space-y-1.5">
                {shopPicker.shops.map((s) => (
                  <li key={s.slug}>
                    <button
                      type="button"
                      disabled={loadingPack !== null}
                      onClick={() => startCreditCheckout(shopPicker.pack, s.slug)}
                      className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-3 py-2.5 text-left text-sm hover:border-[color:var(--color-brand-300)] hover:bg-[color:var(--color-brand-50)] disabled:opacity-60"
                    >
                      <span>
                        <span className="block font-medium">{s.name}</span>
                        <span className="block font-mono text-[11px] text-zinc-500">
                          {storefrontPath(s.slug)}
                        </span>
                      </span>
                      <span className="text-[11px] text-[color:var(--color-brand-700)]">
                        เลือก →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="ghost"
                className="mt-3 w-full"
                onClick={() => setShopPicker(null)}
              >
                ยกเลิก
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
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
