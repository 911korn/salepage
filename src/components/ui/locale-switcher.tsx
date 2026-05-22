"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, type Locale, LOCALE_LABELS } from "@/i18n/routing";
import { cn } from "@/lib/cn";

interface Props {
  className?: string;
  compact?: boolean;
}

export function LocaleSwitcher({ className, compact }: Props) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("common");

  function onChange(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-[color:var(--color-border)] bg-white p-0.5",
        isPending && "opacity-70",
        className,
      )}
    >
      {!compact ? (
        <Languages
          className="ml-1.5 size-3.5 text-zinc-500"
          aria-hidden
        />
      ) : null}
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            aria-pressed={active}
            className={cn(
              "rounded-full px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide transition-colors",
              active
                ? "bg-[color:var(--color-brand-600)] text-white"
                : "text-zinc-600 hover:bg-[color:var(--color-soft)]",
            )}
            title={LOCALE_LABELS[l].native}
          >
            {l === "th" ? "TH" : "EN"}
          </button>
        );
      })}
    </div>
  );
}
