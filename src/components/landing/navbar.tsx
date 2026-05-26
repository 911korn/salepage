"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { cn } from "@/lib/cn";

const NAV_KEYS = [
  // Buyer entry point — first item so it's the most prominent landing
  // CTA after the SalePage logo. Links to the buyer hub `/shops`
  // (911korn 2026-05-27: "หน้าแรกกดตรงไหน ถึงจะไปหน้า Shopping Page
  // ได้"). The other items are still in-page anchors for marketing.
  { href: "/shops", key: "shop" },
  { href: "#features", key: "features" },
  { href: "#promptpay", key: "promptpay" },
  { href: "#preview", key: "preview" },
  { href: "#pricing", key: "pricing" },
] as const;

interface Props {
  signedIn?: boolean;
}

export function Navbar({ signedIn = false }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-[backdrop-filter,background-color,border-color] duration-200",
        scrolled
          ? "border-b border-[color:var(--color-border)] bg-white/85 backdrop-blur-xl"
          : "border-b border-transparent bg-white/0",
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark glow />
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_KEYS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-[color:var(--color-soft)] hover:text-[color:var(--color-fg)]"
            >
              {tNav(l.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher className="hidden md:inline-flex" />
          {signedIn ? (
            <Link
              href="/dashboard"
              className={cn(
                buttonStyles({ size: "sm" }),
                "hidden md:inline-flex",
              )}
            >
              {tCommon("dashboard")}
            </Link>
          ) : (
            <>
              <Link
                href="/signin"
                className="hidden text-sm font-medium text-zinc-700 hover:text-[color:var(--color-fg)] md:inline-flex md:px-3 md:py-2"
              >
                {tCommon("signIn")}
              </Link>
              <Link
                href="/signup"
                className={cn(
                  buttonStyles({ size: "sm" }),
                  "hidden md:inline-flex",
                )}
              >
                {tCommon("createFreeShop")}
              </Link>
            </>
          )}
          <button
            type="button"
            aria-label={tCommon("menu")}
            onClick={() => setOpen((v) => !v)}
            className="grid size-10 place-items-center rounded-lg border border-[color:var(--color-border)] bg-white md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="md:hidden">
          <div className="border-t border-[color:var(--color-border)] bg-white px-5 py-4">
            <nav className="flex flex-col gap-1">
              {NAV_KEYS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-[15px] font-medium text-zinc-800 hover:bg-[color:var(--color-soft)]"
                >
                  {tNav(l.key)}
                </Link>
              ))}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {tCommon("language")}
                </span>
                <LocaleSwitcher />
              </div>
              {signedIn ? (
                <div className="mt-2 pt-2">
                  <Link
                    href="/dashboard"
                    className="block rounded-xl bg-[color:var(--color-brand-600)] py-3 text-center text-[15px] font-medium text-white"
                  >
                    {tCommon("dashboard")}
                  </Link>
                </div>
              ) : (
                <div className="mt-2 flex gap-2 pt-2">
                  <Link
                    href="/signin"
                    className="flex-1 rounded-xl border border-[color:var(--color-border)] py-3 text-center text-[15px] font-medium"
                  >
                    {tCommon("signIn")}
                  </Link>
                  <Link
                    href="/signup"
                    className="flex-1 rounded-xl bg-[color:var(--color-brand-600)] py-3 text-center text-[15px] font-medium text-white"
                  >
                    {tCommon("createFreeShop")}
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
