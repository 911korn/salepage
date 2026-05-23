"use client";

import { useState } from "react";
import {
  Bell,
  ChartBar,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Star,
  Ticket,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { Link, usePathname } from "@/i18n/navigation";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface ShopOption {
  id: string;
  slug: string;
  name: string;
  logoText: string | null;
  themeColor: string;
  status: string;
}

interface UserSummary {
  name: string | null;
  email: string | null;
  image: string | null;
  plan?: string;
  isAdmin?: boolean;
}

interface Props {
  shops: ShopOption[];
  activeShopSlug: string | null;
  user: UserSummary;
}

const MAIN_LINKS = [
  { href: "/dashboard", key: "overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", key: "orders", icon: Package },
  { href: "/dashboard/products", key: "products", icon: ShoppingBag },
  { href: "/dashboard/settings", key: "settings", icon: Settings },
] as const;

const TOOL_LINKS = [
  { href: "/dashboard/analytics", key: "analytics", icon: ChartBar },
  { href: "/dashboard/chat", key: "chat", icon: MessageCircle },
  { href: "/dashboard/coupons", key: "coupons", icon: Ticket },
  { href: "/dashboard/customers", key: "customers", icon: Users },
  { href: "/dashboard/reviews", key: "reviews", icon: Star },
  { href: "/dashboard/announcements", key: "announcements", icon: Bell },
] as const;

export function DashboardSidebar({ shops, activeShopSlug, user }: Props) {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const [shopMenuOpen, setShopMenuOpen] = useState(false);

  const activeShop = shops.find((s) => s.slug === activeShopSlug) ?? shops[0];

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[color:var(--color-border)] bg-white lg:flex">
      {/* Logo / brand */}
      <div className="flex h-16 items-center gap-2 border-b border-[color:var(--color-border)] px-5">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark />
          <Wordmark />
        </Link>
      </div>

      {/* Shop switcher */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => setShopMenuOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 transition-colors hover:bg-[color:var(--color-soft)]"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {activeShop ? (
              <>
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl font-display text-sm font-bold text-white"
                  style={{ background: activeShop.themeColor }}
                >
                  {activeShop.logoText ?? activeShop.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 text-left">
                  <span className="block truncate text-sm font-semibold">
                    {activeShop.name}
                  </span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {t("common.open")}
                  </span>
                </span>
              </>
            ) : (
              <span className="text-sm text-zinc-500">{t("empty.title")}</span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-zinc-500 transition-transform",
              shopMenuOpen && "rotate-180",
            )}
          />
        </button>
        {shopMenuOpen ? (
          <div className="mt-2 rounded-2xl border border-[color:var(--color-border)] bg-white p-1.5 shadow-md">
            {shops.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard?shop=${s.slug}`}
                onClick={() => setShopMenuOpen(false)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[color:var(--color-soft)]",
                  s.slug === activeShopSlug && "bg-[color:var(--color-brand-50)] font-medium",
                )}
              >
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-md font-display text-[10px] font-bold text-white"
                  style={{ background: s.themeColor }}
                >
                  {s.logoText ?? s.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{s.name}</span>
              </Link>
            ))}
            <Link
              href="/dashboard/create-shop"
              onClick={() => setShopMenuOpen(false)}
              className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-[color:var(--color-border)] px-2 py-2 text-sm text-[color:var(--color-brand-700)] hover:bg-[color:var(--color-brand-50)]"
            >
              <Plus className="size-4" />
              {t("common.createShop")}
            </Link>
          </div>
        ) : null}
      </div>

      {/* Nav */}
      <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
        <NavSection label={t("common.menuMain")}>
          {MAIN_LINKS.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              icon={l.icon}
              label={t(`nav.${l.key}`)}
              active={pathname === l.href}
            />
          ))}
        </NavSection>

        <NavSection label={t("common.menuTools")} className="mt-6">
          {TOOL_LINKS.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              icon={l.icon}
              label={t(`nav.${l.key}`)}
              active={pathname === l.href}
            />
          ))}
        </NavSection>
      </nav>

      {/* User footer */}
      <div className="border-t border-[color:var(--color-border)] px-3 py-3">
        <div className="rounded-2xl bg-[color:var(--color-soft)] px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-200 text-xs font-semibold uppercase text-zinc-600">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="size-full object-cover" />
              ) : (
                (user.name ?? user.email ?? "?").trim().charAt(0)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold">
                {user.name ?? user.email}
              </p>
              {user.plan ? (
                <Badge tone="soft-brand" className="mt-0.5 text-[10px]">
                  {user.plan}
                </Badge>
              ) : (
                <p className="text-[10px] text-zinc-500">Free</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-white px-2 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <LogOut className="size-3.5" /> {t("common.signOut")}
          </button>
        </div>
        {user.isAdmin ? (
          <Link
            href="/admin"
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-2 py-1.5 text-[12px] font-medium text-white hover:bg-zinc-800"
          >
            <ShieldAlert className="size-3.5" /> เปิด Admin Panel
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

function NavSection({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
        {label}
      </p>
      <ul className="mt-1.5 space-y-0.5">{children}</ul>
    </div>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
          active
            ? "bg-[color:var(--color-brand-50)] font-medium text-[color:var(--color-brand-700)]"
            : "text-zinc-700 hover:bg-[color:var(--color-soft)]",
        )}
      >
        <Icon className="size-4 shrink-0" strokeWidth={2.25} />
        <span>{label}</span>
      </Link>
    </li>
  );
}
