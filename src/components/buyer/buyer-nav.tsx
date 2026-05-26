"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Search, Store, Package, User2, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { cn } from "@/lib/cn";
import { useCart, selectItemCount } from "@/lib/cart-store";

interface Props {
  /** Pre-loaded session info from server. Drives the avatar dropdown. */
  user: {
    name: string | null;
    email: string;
    image: string | null;
    hasShops: boolean;
  } | null;
}

/**
 * App-style top navigation chrome for buyer surfaces (/shops, /search,
 * /cart, /me/*). Mirrors the four-tab pattern from the mobile app's
 * bottom tabs (911korn 2026-05-27: "หน้าเว็บต้องทำให้ Work Flow ทุกอย่าง
 * เท่า App"). Logo on the left, search field in the middle, cart icon
 * + account dropdown on the right.
 */
export function BuyerNav({ user }: Props) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-[backdrop-filter,background-color,border-color] duration-200",
        scrolled
          ? "border-b border-[color:var(--color-border)] bg-white/90 backdrop-blur-xl"
          : "border-b border-[color:var(--color-border)]/50 bg-white",
      )}
    >
      <div className="container-page flex h-16 items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark glow />
          <Wordmark className="hidden sm:inline-flex" />
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-2">
          <NavLink href="/shops" icon={<Store size={16} />}>
            ร้านค้าทั้งหมด
          </NavLink>
          {user ? (
            <NavLink href="/me/orders" icon={<Package size={16} />}>
              คำสั่งซื้อของฉัน
            </NavLink>
          ) : null}
        </nav>

        <SearchField />

        <CartButton />

        <AccountMenu user={user} />
      </div>
    </header>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-[color:var(--color-soft)] hover:text-[color:var(--color-fg)]"
    >
      {icon}
      {children}
    </Link>
  );
}

function SearchField() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="ml-2 flex flex-1 items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-soft)]/50 px-3 py-1.5 max-w-md focus-within:border-[color:var(--color-brand)]/40 focus-within:bg-white"
    >
      <Search size={16} className="text-zinc-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาสินค้าหรือร้าน"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
      />
    </form>
  );
}

function CartButton() {
  const itemCount = useCart(selectItemCount);
  const [mounted, setMounted] = useState(false);
  // Avoid SSR hydration mismatch — the persisted cart only resolves
  // after the localStorage rehydrate fires on the client.
  useEffect(() => setMounted(true), []);
  const showBadge = mounted && itemCount > 0;
  return (
    <Link
      href="/cart"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 hover:bg-[color:var(--color-soft)]"
      aria-label="View cart"
    >
      <ShoppingBag size={20} />
      {showBadge ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[color:var(--color-brand)] px-1 text-[10px] font-bold text-white">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </Link>
  );
}

function AccountMenu({ user }: { user: Props["user"] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!user) {
    return (
      <Link
        href="/signin"
        className="rounded-full bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-700)]"
      >
        เข้าสู่ระบบ
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-soft)] hover:border-[color:var(--color-brand)]/30"
        aria-label="Account menu"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <User2 size={18} className="text-zinc-600" />
        )}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white shadow-lg">
          <div className="border-b border-[color:var(--color-border)] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[color:var(--color-fg)]">
              {user.name ?? user.email.split("@")[0]}
            </p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
          <MenuItem href="/me/orders" icon={<Package size={15} />}>
            คำสั่งซื้อของฉัน
          </MenuItem>
          <MenuItem href="/me" icon={<User2 size={15} />}>
            โปรไฟล์ + ที่อยู่
          </MenuItem>
          <MenuItem
            href={user.hasShops ? "/dashboard" : "/dashboard"}
            icon={<Store size={15} />}
          >
            {user.hasShops ? "จัดการร้านค้า" : "เริ่มขายบน SalePage"}
          </MenuItem>
          <button
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2 border-t border-[color:var(--color-border)] px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
          >
            <LogOut size={15} />
            ออกจากระบบ
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-[color:var(--color-soft)]"
    >
      {icon}
      {children}
    </Link>
  );
}
