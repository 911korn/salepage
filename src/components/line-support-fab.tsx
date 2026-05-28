"use client";

import { usePathname } from "next/navigation";
import { LineIcon } from "@/components/ui/line-icon";

/**
 * Floating LINE Support button — pinned bottom-right on every public page
 * so a buyer/visitor can tap and start a chat with the SalePage team on
 * our official LINE OA.
 *
 * Skipped on /dashboard/* and /admin/* — those are seller/operator
 * consoles where the bottom-right space is taken by the mobile tab bar
 * and the user is already authenticated into the support flow.
 *
 * The destination is taken from `NEXT_PUBLIC_SUPPORT_LINE_OA` so we can
 * change the OA target without a re-deploy. Falls back to the documented
 * support email if the env var isn't set, so the button still does
 * something useful in dev/preview environments.
 */
export function LineSupportFab() {
  const pathname = usePathname() ?? "";
  const onSellerSurface =
    pathname.startsWith("/dashboard") ||
    pathname.includes("/dashboard/") ||
    pathname.startsWith("/admin") ||
    pathname.includes("/admin/");
  if (onSellerSurface) return null;

  const oa = process.env.NEXT_PUBLIC_SUPPORT_LINE_OA?.trim();
  const href = oa
    ? `https://line.me/R/ti/p/${oa.startsWith("@") ? "%40" + oa.slice(1) : oa}`
    : "mailto:hello@salepage.in.th";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="LINE Support"
      className="group fixed bottom-5 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[#06C755] py-2.5 pl-2.5 pr-4 text-white shadow-[0_10px_30px_-8px_rgb(6_199_85/0.55)] transition-transform hover:-translate-y-0.5 active:scale-95 sm:bottom-6 sm:right-6"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
    >
      <LineIcon className="size-7 rounded-lg" />
      <span className="text-[13px] font-semibold leading-none">
        แชทกับเรา
      </span>
    </a>
  );
}
