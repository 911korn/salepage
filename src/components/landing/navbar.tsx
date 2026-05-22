"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { href: "#features", label: "ฟีเจอร์" },
  { href: "#promptpay", label: "PromptPay & สลิป" },
  { href: "#preview", label: "ตัวอย่างร้าน" },
  { href: "#pricing", label: "ราคา" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-[color:var(--color-soft)] hover:text-[color:var(--color-fg)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-zinc-700 hover:text-[color:var(--color-fg)] md:inline-flex md:px-3 md:py-2"
          >
            เข้าสู่ระบบ
          </Link>
          <Link
            href="/signup"
            className={cn(
              buttonStyles({ size: "sm" }),
              "hidden md:inline-flex",
            )}
          >
            สร้างร้านฟรี
          </Link>
          <button
            type="button"
            aria-label="เมนู"
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
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-[15px] font-medium text-zinc-800 hover:bg-[color:var(--color-soft)]"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 flex gap-2 pt-2">
                <Link
                  href="/login"
                  className="flex-1 rounded-xl border border-[color:var(--color-border)] py-3 text-center text-[15px] font-medium"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/signup"
                  className="flex-1 rounded-xl bg-[color:var(--color-brand-600)] py-3 text-center text-[15px] font-medium text-white"
                >
                  สร้างร้านฟรี
                </Link>
              </div>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
