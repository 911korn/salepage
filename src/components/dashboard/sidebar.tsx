"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { Link, usePathname } from "@/i18n/navigation";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { dashboardHref, resolveDashboardShop } from "@/lib/dashboard-routing";

export interface DashboardShopOption {
  id: string;
  slug: string;
  name: string;
  logoText: string | null;
  themeColor: string;
  status: string;
}

export interface DashboardUserSummary {
  name: string | null;
  email: string | null;
  image: string | null;
  plan?: string;
  isAdmin?: boolean;
}

interface Props {
  shops: DashboardShopOption[];
  activeShopSlug: string | null;
  user: DashboardUserSummary;
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
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[color:var(--color-border)] bg-white print:hidden lg:flex">
      <DashboardSidebarInner
        shops={shops}
        activeShopSlug={activeShopSlug}
        user={user}
        isActive={isActive}
      />
    </aside>
  );
}

export function DashboardMobileDrawer({
  open,
  onClose,
  shops,
  activeShopSlug,
  user,
}: Props & { open: boolean; onClose: () => void }) {
  const tCommon = useTranslations("dashboard.common");
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 print:hidden lg:hidden">
      <button
        type="button"
        aria-label={tCommon("closeMenu")}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/45"
      />
      <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[88vw] flex-col bg-white shadow-2xl">
        <DashboardSidebarInner
          shops={shops}
          activeShopSlug={activeShopSlug}
          user={user}
          isActive={isActive}
          onClose={onClose}
          showClose
        />
      </aside>
    </div>
  );
}

function DashboardSidebarInner({
  shops,
  activeShopSlug,
  user,
  isActive,
  onClose,
  showClose,
}: Props & {
  isActive: (href: string) => boolean;
  onClose?: () => void;
  showClose?: boolean;
}) {
  const t = useTranslations("dashboard");
  const searchParams = useSearchParams();
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const activeShop = resolveDashboardShop(
    shops,
    searchParams.get("shop") ?? activeShopSlug,
  );
  const currentShopSlug = activeShop?.slug ?? null;
  const hrefWithShop = (href: string) => dashboardHref(href, currentShopSlug);

  return (
    <>
      {/* Logo / brand */}
      <div className="flex h-16 items-center justify-between gap-2 border-b border-[color:var(--color-border)] px-5">
        <Link href="/" onClick={onClose} className="flex items-center gap-2">
          <LogoMark />
          <Wordmark />
        </Link>
        {showClose ? (
          <button
            type="button"
            aria-label={t("common.closeMenu")}
            onClick={onClose}
            className="grid size-11 place-items-center rounded-xl text-zinc-500 hover:bg-[color:var(--color-soft)] hover:text-zinc-900"
          >
            <X className="size-5" />
          </button>
        ) : null}
      </div>

      {/* Shop switcher */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => setShopMenuOpen((v) => !v)}
          className="flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border border-[color:var(--color-border)] bg-white px-3 py-2.5 transition-colors hover:bg-[color:var(--color-soft)]"
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
                href={dashboardHref("/dashboard", s.slug)}
                onClick={() => {
                  setShopMenuOpen(false);
                  onClose?.();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[color:var(--color-soft)]",
                  s.slug === currentShopSlug && "bg-[color:var(--color-brand-50)] font-medium",
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
              onClick={() => {
                setShopMenuOpen(false);
                onClose?.();
              }}
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
        {showClose ? (
          <div>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              {t("common.menuMain")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {MAIN_LINKS.map((l) => (
                <MobilePrimaryLink
                  key={l.href}
                  href={hrefWithShop(l.href)}
                  icon={l.icon}
                  label={t(`nav.${l.key}`)}
                  active={isActive(l.href)}
                  onClick={onClose}
                />
              ))}
            </div>
          </div>
        ) : (
          <NavSection label={t("common.menuMain")}>
            {MAIN_LINKS.map((l) => (
              <NavLink
                key={l.href}
                href={l.href}
                displayHref={hrefWithShop(l.href)}
                icon={l.icon}
                label={t(`nav.${l.key}`)}
                active={isActive(l.href)}
                onClick={onClose}
              />
            ))}
          </NavSection>
        )}

        <NavSection label={t("common.menuTools")} className="mt-6">
          {TOOL_LINKS.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              displayHref={hrefWithShop(l.href)}
              icon={l.icon}
              label={t(`nav.${l.key}`)}
              active={isActive(l.href)}
              onClick={onClose}
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
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[color:var(--color-border)] bg-white px-2 py-2 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <LogOut className="size-3.5" /> {t("common.signOut")}
          </button>
        </div>
        {user.isAdmin ? (
          <Link
            href="/admin"
            onClick={onClose}
            className="mt-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-2 py-2 text-[12px] font-medium text-white hover:bg-zinc-800"
          >
            <ShieldAlert className="size-3.5" /> เปิด Admin Panel
          </Link>
        ) : null}
      </div>
    </>
  );
}

export function DashboardBottomNav() {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentShopSlug = searchParams.get("shop");
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  return (
    <nav
      aria-label={t("common.mobileNav")}
      className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 border-t border-[color:var(--color-border)] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(15_23_42/0.08)] backdrop-blur print:hidden lg:hidden"
    >
      {MAIN_LINKS.map((link) => {
        const Icon = link.icon;
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={dashboardHref(link.href, currentShopSlug)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium",
              active
                ? "text-[color:var(--color-brand-700)]"
                : "text-zinc-500 active:bg-[color:var(--color-soft)]",
            )}
          >
            <Icon
              className={cn(
                "size-5",
                active &&
                  "rounded-lg bg-[color:var(--color-brand-50)] p-0.5 text-[color:var(--color-brand-700)]",
              )}
              strokeWidth={2.35}
            />
            <span className="w-full truncate text-center">{t(`nav.${link.key}`)}</span>
          </Link>
        );
      })}
    </nav>
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
  displayHref,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  href: string;
  displayHref?: string;
  icon: typeof LayoutDashboard;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <li>
      <Link
        href={displayHref ?? href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
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

function MobilePrimaryLink({
  href,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[76px] flex-col justify-between rounded-2xl border bg-white p-3 text-left transition-colors active:scale-[0.99]",
        active
          ? "border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] shadow-sm"
          : "border-[color:var(--color-border)] text-zinc-700 active:bg-[color:var(--color-soft)]",
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={2.35} />
      <span className="truncate text-[15px] font-semibold leading-5">{label}</span>
    </Link>
  );
}
