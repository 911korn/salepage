"use client";

import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";

const COOKIE_NAME = "salepage_cc_v1";

export function CookieConsent() {
  const t = useTranslations("cookie");
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const has = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
    if (!has) setShown(true);
  }, []);

  if (!shown) return null;

  function accept() {
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIE_NAME}=accepted; path=/; max-age=${oneYear}; samesite=lax${
      location.protocol === "https:" ? "; secure" : ""
    }`;
    setShown(false);
  }

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4 print:hidden"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-[color:var(--color-border)] bg-white p-4 shadow-xl shadow-zinc-900/10 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)]">
            <Cookie className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-semibold leading-snug">
              {t("title")}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
              {t("body")}{" "}
              <Link
                href="/privacy"
                className="font-medium text-[color:var(--color-brand-700)] hover:underline"
              >
                {t("readPolicy")}
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShown(false)}
            aria-label={t("dismiss")}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={accept}
            className={cn(buttonStyles({ size: "sm" }))}
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
