"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { storefrontPath } from "@/lib/storefront-url";

export function FinalCta() {
  const t = useTranslations("finalCta");
  const tCommon = useTranslations("common");
  return (
    <section className="relative overflow-hidden py-20 sm:py-24">
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[color:var(--color-brand-600)] via-rose-600 to-[color:var(--color-brand-700)] px-6 py-14 text-center text-white shadow-2xl shadow-rose-200 sm:px-10 sm:py-20"
        >
          <div className="absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="absolute -top-20 right-0 size-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 left-0 size-72 rounded-full bg-white/10 blur-3xl" />

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
            <Sparkles className="size-3.5" /> {t("tagline")}
          </span>
          <h2 className="font-display mx-auto mt-5 max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-[17px] leading-relaxed text-rose-50/90">
            {t("desc")}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className={cn(
                buttonStyles({ size: "xl" }),
                "w-full bg-white !text-[color:var(--color-brand-700)] hover:bg-rose-50 hover:!text-[color:var(--color-brand-800)] sm:w-auto",
              )}
            >
              {tCommon("createFreeShop")}
              <ArrowRight className="size-5" />
            </Link>
            <Link
              href={storefrontPath("siam-snack")}
              className="text-sm font-medium text-rose-50 underline-offset-4 hover:underline"
            >
              {t("secondary")}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
