"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { dashboardHref } from "@/lib/dashboard-routing";

export function StorefrontOwnerCta({
  slug,
  manageLabel,
  createShort,
  createLong,
}: {
  slug: string;
  manageLabel: string;
  createShort: string;
  createLong: string;
}) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/shops/${encodeURIComponent(slug)}/viewer`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.ok && json.data?.isOwner) setIsOwner(true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [slug]);

  return (
    <Link
      href={isOwner ? dashboardHref("/dashboard", slug) : "/signup"}
      className={cn(
        buttonStyles({
          size: "sm",
          className: "shrink-0 px-2.5 text-xs sm:px-3.5 sm:text-sm",
        }),
      )}
    >
      {isOwner ? (
        manageLabel
      ) : (
        <>
          <span className="sm:hidden">{createShort}</span>
          <span className="hidden sm:inline">{createLong}</span>
        </>
      )}
    </Link>
  );
}
