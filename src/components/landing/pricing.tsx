"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const PLANS = [
  {
    id: "starter",
    price: "฿0",
    suffixKey: "lifetime" as const,
    href: "/signup",
    highlight: false,
  },
  {
    id: "pro",
    price: "฿299",
    suffixKey: "perMonth" as const,
    href: "/signup?plan=pro",
    highlight: true,
  },
  {
    id: "business",
    price: "฿790",
    suffixKey: "perMonth" as const,
    href: "/contact",
    highlight: false,
  },
] as const;

export function Pricing() {
  const t = useTranslations("pricing");
  const tCommon = useTranslations("common");
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

        <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:gap-6">
          {PLANS.map((p, i) => {
            const features = t.raw(`plans.${p.id}.features`) as string[];
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className={cn(
                  "relative flex flex-col rounded-3xl border bg-white p-6 transition-shadow sm:p-7",
                  p.highlight
                    ? "border-[color:var(--color-brand-300)] shadow-xl shadow-rose-100/60 lg:scale-[1.02]"
                    : "border-[color:var(--color-border)] shadow-sm",
                )}
              >
                {p.highlight ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--color-brand-600)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-md">
                    {tCommon("recommended")}
                  </span>
                ) : null}

                <div>
                  <h3 className="font-display text-lg font-bold sm:text-xl">
                    {t(`plans.${p.id}.name`)}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    {t(`plans.${p.id}.desc`)}
                  </p>
                </div>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "font-display text-4xl font-bold sm:text-5xl",
                      p.highlight && "text-[color:var(--color-brand-600)]",
                    )}
                  >
                    {p.price}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {t(p.suffixKey)}
                  </span>
                </div>

                <Link
                  href={p.href}
                  className={cn(
                    buttonStyles({
                      size: "lg",
                      variant: p.highlight ? "primary" : "outline",
                    }),
                    "mt-6 w-full",
                  )}
                >
                  {t(`plans.${p.id}.cta`)}
                </Link>

                <ul className="mt-6 space-y-3 text-[14px]">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
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

        <p className="mt-8 text-center text-sm text-zinc-500">{t("footnote")}</p>
      </div>
    </section>
  );
}
