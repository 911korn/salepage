"use client";

import { ExternalLink, Link as LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { cn } from "@/lib/cn";

interface Props {
  shop: { slug: string; name: string } | null;
}

export function DashboardTopbar({ shop }: Props) {
  const t = useTranslations("dashboard.common");
  const shopLink = shop ? `https://salepage.in.th/${shop.slug}` : "";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[color:var(--color-border)] bg-white/90 px-4 backdrop-blur lg:px-6">
      <div className="flex-1">
        {shop ? (
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <Badge tone="success" className="text-[10px] uppercase">
              Live
            </Badge>
            <span className="font-mono text-[12px] text-zinc-500">
              salepage.in.th/{shop.slug}
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <LocaleSwitcher />
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
              href={`/s/${shop.slug}`}
              className={cn(buttonStyles({ size: "sm" }))}
              target="_blank"
            >
              <ExternalLink className="size-4" /> {t("viewShop")}
            </Link>
          </>
        ) : null}
      </div>
    </header>
  );
}
