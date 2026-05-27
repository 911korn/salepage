"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  Building2,
  CreditCard,
  Flag,
  Gauge,
  LogOut,
  Menu,
  Package,
  Lock,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  Ticket,
  Wallet,
  Users,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Link, usePathname } from "@/i18n/navigation";
import { LogoMark } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface Viewer {
  name: string | null;
  email: string;
  role: string;
  isSuperAdmin: boolean;
}

interface Props {
  viewer: Viewer;
  children: React.ReactNode;
}

const NAV_SECTIONS = [
  {
    label: "ภาพรวม",
    links: [
      { href: "/admin", label: "Overview", icon: Gauge, exact: true },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    ],
  },
  {
    label: "ผู้ใช้ + ร้าน",
    links: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/shops", label: "Shops", icon: Building2 },
      { href: "/admin/kyc", label: "KYC review", icon: ShieldCheck },
      { href: "/admin/orders", label: "Orders", icon: Package },
      { href: "/admin/disputes", label: "Disputes", icon: ShieldAlert },
      { href: "/admin/reports", label: "Reports", icon: Flag },
    ],
  },
  {
    label: "การเงิน",
    links: [
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
      { href: "/admin/events", label: "Stripe events", icon: Activity },
      { href: "/admin/payouts", label: "Affiliate payouts", icon: Wallet },
      { href: "/admin/escrow", label: "Protected Pay", icon: Lock },
    ],
  },
  {
    label: "เนื้อหา + โปรโมชั่น",
    links: [
      { href: "/admin/reviews", label: "Reviews", icon: Star },
      { href: "/admin/coupons", label: "Coupons", icon: Ticket },
    ],
  },
  {
    label: "ระบบ",
    links: [
      { href: "/admin/settings", label: "Platform settings", icon: Settings },
    ],
  },
] as const;

export function AdminShell({ viewer, children }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-zinc-200 bg-white px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="grid size-9 place-items-center rounded-lg hover:bg-zinc-100"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/admin" className="flex items-center gap-1.5">
          <LogoMark className="size-7" />
          <span className="font-display text-sm font-bold tracking-tight">
            Admin
          </span>
        </Link>
        <span className="ml-auto">
          <Badge tone="brand" className="text-[10px] uppercase">
            {viewer.isSuperAdmin ? "Super" : "Admin"}
          </Badge>
        </span>
      </header>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-zinc-950 text-zinc-200 shadow-2xl">
            <SidebarInner
              viewer={viewer}
              isActive={isActive}
              onClose={() => setMobileOpen(false)}
              showClose
            />
          </aside>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-900/30 bg-zinc-950 text-zinc-200 lg:flex">
        <SidebarInner viewer={viewer} isActive={isActive} />
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 px-4 pt-20 pb-12 sm:px-6 lg:px-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}

function SidebarInner({
  viewer,
  isActive,
  onClose,
  showClose,
}: {
  viewer: Viewer;
  isActive: (href: string, exact?: boolean) => boolean;
  onClose?: () => void;
  showClose?: boolean;
}) {
  return (
    <>
      {/* Brand */}
      <div className="flex h-16 items-center justify-between gap-2 border-b border-zinc-900/50 px-4">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-[color:var(--color-brand-600)] text-white">
            <ShieldAlert className="size-5" strokeWidth={2.4} />
          </span>
          <div>
            <p className="font-display text-sm font-bold tracking-tight text-white">
              SalePage Admin
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              Platform console
            </p>
          </div>
        </Link>
        {showClose ? (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mt-4 first:mt-0">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {section.label}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {section.links.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href, "exact" in link ? link.exact : false);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-[color:var(--color-brand-600)] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]"
                          : "text-zinc-300 hover:bg-zinc-900 hover:text-white",
                      )}
                    >
                      <Icon className="size-4 shrink-0" strokeWidth={2.25} />
                      <span>{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: viewer card */}
      <div className="border-t border-zinc-900/50 px-3 py-3">
        <div className="rounded-xl bg-zinc-900 px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--color-brand-600)] text-xs font-bold uppercase text-white">
              {(viewer.name ?? viewer.email).trim().charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-white">
                {viewer.name ?? viewer.email.split("@")[0]}
              </p>
              <p className="truncate text-[10px] text-zinc-500">
                {viewer.email}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Badge
              tone={viewer.isSuperAdmin ? "brand" : "soft-brand"}
              className="text-[10px] uppercase"
            >
              {viewer.isSuperAdmin ? "Super admin" : "Admin"}
            </Badge>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
            >
              <LogOut className="size-3" /> ออก
            </button>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 px-2 py-1.5 text-[11px] text-zinc-400 hover:bg-zinc-900 hover:text-white"
        >
          <Bell className="size-3" /> ไป Dashboard
        </Link>
      </div>
    </>
  );
}
