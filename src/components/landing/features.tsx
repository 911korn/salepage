"use client";

import {
  Banknote,
  Bot,
  Clock,
  Layers,
  Link2,
  type LucideIcon,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

interface Feature {
  key: string;
  icon: LucideIcon;
}

const FEATURES: Feature[] = [
  { key: "fees", icon: Banknote },
  { key: "ai", icon: Bot },
  { key: "shipping", icon: Truck },
  { key: "speed", icon: Clock },
  { key: "qr", icon: QrCode },
  { key: "link", icon: Link2 },
  { key: "admin", icon: ShieldCheck },
  { key: "mobile", icon: Smartphone },
  { key: "theme", icon: Layers },
  { key: "performance", icon: Zap },
];

export function Features() {
  const t = useTranslations("features");
  return (
    <section id="features" className="py-20 sm:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-brand-50)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-brand-700)]">
            <Sparkles className="size-3.5" /> {t("tagline")}
          </span>
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

        <div className="mt-12 grid gap-3 sm:gap-4 md:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.key} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  const t = useTranslations(`features.items.${feature.key}`);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3) }}
      className="group relative overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--color-brand-200)] hover:shadow-lg hover:shadow-rose-100/60 sm:p-6"
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-brand-200)] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start gap-4">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] transition-colors group-hover:bg-[color:var(--color-brand-600)] group-hover:text-white">
          <Icon className="size-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">
            {t("title")}
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-600 sm:text-[15px]">
            {t("desc")}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
