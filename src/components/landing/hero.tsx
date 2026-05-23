"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { storefrontLabel, storefrontPath } from "@/lib/storefront-url";

interface TickerOrder {
  id: string;
  item: string;
  price: string;
  city: string;
}

export function Hero() {
  const t = useTranslations("hero");
  const tCommon = useTranslations("common");
  return (
    <section className="relative overflow-hidden pb-16 pt-10 sm:pt-14 lg:pb-24 lg:pt-20">
      <div className="absolute inset-0 -z-10 bg-radial-brand" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-grid opacity-60" />

      <div className="container-page">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center"
            >
              <Badge tone="soft-brand" className="px-3 py-1.5">
                <Sparkles className="size-3.5" /> {t("badge")}
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="font-display mt-5 text-balance text-[40px] font-bold leading-[1.05] tracking-tight sm:text-[52px] lg:text-[64px]"
            >
              {t("title1")}{" "}
              <span className="text-[color:var(--color-brand-600)]">
                {t("titleHighlight")}
              </span>
              <br />
              {t("title2")}{" "}
              <span className="relative">
                <span className="relative z-10">{t("titleStruck")}</span>
                <span className="absolute inset-x-0 bottom-1 -z-0 h-3 bg-[color:var(--color-brand-100)]" />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mx-auto mt-5 max-w-xl text-balance text-[17px] leading-relaxed text-zinc-600 sm:text-lg lg:mx-0"
            >
              {t.rich("desc", {
                qr: (chunks) => (
                  <strong className="text-[color:var(--color-brand-700)]">
                    {chunks}
                  </strong>
                ),
                ai: (chunks) => (
                  <strong className="text-[color:var(--color-brand-700)]">
                    {chunks}
                  </strong>
                ),
              })}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
            >
              <Link
                href="/signup"
                className={cn(buttonStyles({ size: "xl" }), "w-full sm:w-auto")}
              >
                {tCommon("createFreeShop")}
                <ArrowRight className="size-5" />
              </Link>
              <Link
                href={storefrontPath("siam-snack")}
                className={cn(
                  buttonStyles({ variant: "outline", size: "xl" }),
                  "w-full sm:w-auto",
                )}
              >
                <ShoppingBag className="size-5" />{" "}
                {tCommon("viewExample")}
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-zinc-600 lg:justify-start"
            >
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" /> {t("trustFree")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" /> {t("trustNoCard")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" />{" "}
                {t("trustDirect")}
              </span>
            </motion.div>
          </div>

          <HeroVisual />
        </div>

        <OrderTicker />
      </div>
    </section>
  );
}

function HeroVisual() {
  const t = useTranslations("hero");
  const tCommon = useTranslations("common");
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, delay: 0.2 }}
      className="relative mx-auto w-full max-w-md lg:max-w-none"
    >
      <div className="absolute -inset-4 -z-10 rounded-[36px] bg-gradient-to-br from-rose-100 via-white to-amber-100 blur-2xl" />
      <div className="relative rounded-[28px] border border-[color:var(--color-border)] bg-white p-2 shadow-xl shadow-rose-100/60 glow-brand">
        <div className="rounded-[22px] bg-gradient-to-br from-rose-50 via-white to-rose-50 p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-[color:var(--color-brand-600)] font-display text-lg font-bold text-white shadow-lg shadow-rose-200">
                ส
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-display text-base font-bold">สยามสแน็ค</p>
                  <ShieldCheck className="size-4 text-[color:var(--color-brand-600)]" />
                </div>
                <p className="text-xs text-zinc-500">
                  {storefrontLabel("siam-snack")}
                </p>
              </div>
            </div>
            <Badge tone="success" className="hidden sm:inline-flex">
              {tCommon("open")}
            </Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <ProductCard
              gradient="from-yellow-200 via-yellow-300 to-amber-400"
              name={t("previewProductHotName")}
              price="฿290"
              compare="฿390"
              badge="HOT"
            />
            <ProductCard
              gradient="from-emerald-200 to-emerald-400"
              name={t("previewProductSaleName")}
              price="฿89"
              compare="฿120"
              badge="SALE"
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-[color:var(--color-brand-200)] bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
                <QrCode className="size-5" />
              </span>
              <div>
                <p className="text-[13px] font-medium">{t("previewQrLabel")}</p>
                <p className="text-[11px] text-zinc-500">{t("previewQrOrder")}</p>
              </div>
            </div>
            <Badge tone="brand">
              <Zap className="size-3" /> Auto
            </Badge>
          </div>
        </div>
      </div>

      <FloatingNotification />
    </motion.div>
  );
}

function ProductCard({
  gradient,
  name,
  price,
  compare,
  badge,
}: {
  gradient: string;
  name: string;
  price: string;
  compare?: string;
  badge?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white bg-white shadow-sm">
      <div
        className={cn(
          "relative aspect-square w-full bg-gradient-to-br",
          gradient,
        )}
      >
        {badge ? (
          <span className="absolute left-2 top-2 rounded-full bg-[color:var(--color-brand-600)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-1 text-[12px] font-medium">{name}</p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-[color:var(--color-brand-700)]">
            {price}
          </span>
          {compare ? (
            <span className="text-[11px] text-zinc-400 line-through">
              {compare}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FloatingNotification() {
  const t = useTranslations("hero");
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="absolute -bottom-3 -left-3 hidden w-[240px] rounded-2xl border border-[color:var(--color-border)] bg-white p-3 shadow-lg shadow-zinc-200 sm:block"
    >
      <div className="flex items-center gap-3">
        <span className="relative grid size-10 place-items-center rounded-full bg-emerald-50">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-30" />
          <Check className="size-5 text-emerald-600" strokeWidth={3} />
        </span>
        <div className="flex-1">
          <p className="text-[13px] font-semibold">{t("previewSlipVerified")}</p>
          <p className="text-[11px] text-zinc-500">{t("previewSlipMeta")}</p>
        </div>
      </div>
    </motion.div>
  );
}

function OrderTicker() {
  const t = useTranslations("hero");
  const orders = t.raw("tickerOrders") as TickerOrder[];
  const items = [...orders, ...orders];
  return (
    <div className="mt-14 sm:mt-20">
      <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
        {t("tickerHeading")}
      </p>
      <div className="mt-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]">
        <div className="flex w-max animate-ticker gap-3">
          {items.map((o, i) => (
            <div
              key={i}
              className="flex shrink-0 items-center gap-3 rounded-full border border-[color:var(--color-border)] bg-white/80 px-4 py-2 backdrop-blur"
            >
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="font-mono text-xs text-zinc-500">{o.id}</span>
              <span className="text-sm">{o.item}</span>
              <span className="text-sm font-semibold text-[color:var(--color-brand-700)]">
                {o.price}
              </span>
              <span className="text-xs text-zinc-500">· {o.city}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
