"use client";

import { motion } from "framer-motion";
import { ArrowRight, Eye, ShieldCheck, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DEMO_SHOPS } from "@/lib/demo-data";
import { storefrontLabel, storefrontPath } from "@/lib/storefront-url";

export function StorefrontPreview() {
  const t = useTranslations("preview");
  const shop = DEMO_SHOPS["siam-snack"]!;
  return (
    <section id="preview" className="py-20 sm:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="soft-brand">{t("tagline")}</Badge>
          <h2 className="font-display mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-balance text-[17px] leading-relaxed text-zinc-600">
            {t("desc")}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mt-12 max-w-4xl"
        >
          <div className="overflow-hidden rounded-[28px] border border-[color:var(--color-border)] bg-white shadow-xl shadow-zinc-200/50">
            <div
              className="h-28 sm:h-36"
              style={{ background: shop.banners[0] }}
            />
            <div className="-mt-12 px-5 pb-5 sm:px-7 sm:pb-7">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <div className="grid size-20 place-items-center rounded-2xl border-4 border-white bg-[color:var(--color-brand-600)] font-display text-3xl font-bold text-white shadow-lg">
                    {shop.logo}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-display text-xl font-bold sm:text-2xl">
                        {shop.name}
                      </h3>
                      {shop.verified ? (
                        <ShieldCheck className="size-5 text-[color:var(--color-brand-600)]" />
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                      <span>{storefrontLabel(shop.slug)}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {shop.rating}
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href={storefrontPath(shop.slug)}
                  className={cn(buttonStyles({ size: "md" }), "w-full sm:w-auto")}
                >
                  <Eye className="size-4" /> {t("openShop")}
                </Link>
              </div>

              <p className="mt-5 text-[15px] leading-relaxed text-zinc-700">
                {shop.description}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {shop.products.slice(0, 3).map((p) => (
                  <div
                    key={p.slug}
                    className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white"
                  >
                    <div
                      className="relative aspect-square w-full"
                      style={{ background: p.image }}
                    >
                      {p.badge ? (
                        <span className="absolute left-2 top-2 rounded-full bg-[color:var(--color-brand-600)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          {p.badge}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-[13px] font-medium">
                        {p.name}
                      </p>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-sm font-bold text-[color:var(--color-brand-700)]">
                          ฿{p.price}
                        </span>
                        {p.compareAt ? (
                          <span className="text-[11px] text-zinc-400 line-through">
                            ฿{p.compareAt}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href={storefrontPath(shop.slug)}
                className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-[color:var(--color-brand-700)] hover:underline"
              >
                {t("viewAll")} ({shop.productCount})
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
