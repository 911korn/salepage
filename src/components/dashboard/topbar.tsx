"use client";

import { ExternalLink, Link as LinkIcon, Menu, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { cn } from "@/lib/cn";
import {
  absoluteStorefrontUrl,
  storefrontLabel,
  storefrontPath,
} from "@/lib/storefront-url";

interface Props {
  shop: { slug: string; name: string } | null;
  onOpenMenu?: () => void;
}

export function DashboardTopbar({ shop, onOpenMenu }: Props) {
  const t = useTranslations("dashboard.common");
  const shopLink = shop ? absoluteStorefrontUrl(shop.slug) : "";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 overflow-hidden border-b border-[color:var(--color-border)] bg-white/95 px-3 backdrop-blur print:hidden lg:px-6">
      <button
        type="button"
        aria-label={t("openMenu")}
        onClick={onOpenMenu}
        className="grid size-11 shrink-0 place-items-center rounded-xl border border-[color:var(--color-border)] bg-white text-zinc-700 shadow-sm active:bg-[color:var(--color-soft)] lg:hidden"
      >
        <Menu className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        {shop ? (
          <div className="flex min-w-0 flex-col justify-center">
            <span className="truncate text-[11px] font-medium text-zinc-500 sm:hidden">
              {t("manageShop")}
            </span>
            <span className="hidden min-w-0 items-center gap-2 text-sm text-zinc-600 sm:flex">
              <Badge tone="success" className="text-[10px] uppercase">
                Live
              </Badge>
              <span className="truncate font-mono text-[12px] text-zinc-500">
                {storefrontLabel(shop.slug)}
              </span>
            </span>
            <span className="truncate text-sm font-semibold text-zinc-900 sm:hidden">
              {shop.name}
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Mode switch — Seller → Buyer. Mirrors the mobile app's
            toggle (911korn 2026-05-27: "ใน Dashboard ต้องมีปุ่ม Switch
            Seller Mode Buyer Mode เหมือนในแอพด้วย"). One-tap return to
            the buyer marketplace; the avatar menu in BuyerNav routes
            the other direction. */}
        <Link
          href="/shops"
          prefetch={false}
          className={cn(
            buttonStyles({ variant: "outline", size: "sm" }),
            "hidden sm:inline-flex",
          )}
        >
          <ShoppingBag className="size-4" /> โหมดผู้ซื้อ
        </Link>
        <Link
          href="/shops"
          prefetch={false}
          aria-label="Switch to buyer mode"
          className="grid size-11 place-items-center rounded-xl border border-[color:var(--color-border)] bg-white text-zinc-700 shadow-sm active:bg-[color:var(--color-soft)] sm:hidden"
        >
          <ShoppingBag className="size-4" />
        </Link>
        <LocaleSwitcher compact className="hidden sm:inline-flex" />
        {shop ? (
          <>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(shopLink);
                toast.success(t("linkCopied"));
              }}
              className={cn(
                buttonStyles({ variant: "outline", size: "sm" }),
                "hidden sm:inline-flex",
              )}
            >
              <LinkIcon className="size-4" /> {t("copyLink")}
            </button>
            <Link
              href={storefrontPath(shop.slug)}
              className={cn(
                buttonStyles({ size: "sm" }),
                "h-11 px-3 sm:h-9 sm:px-3.5",
              )}
              prefetch={false}
            >
              <ExternalLink className="size-4" />
              <span className="text-[13px] sm:text-sm">
                <span className="sm:hidden">{t("viewShopShort")}</span>
                <span className="hidden sm:inline">{t("viewShop")}</span>
              </span>
            </Link>
          </>
        ) : null}
      </div>
    </header>
  );
}
