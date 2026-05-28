"use client";

import { usePathname } from "next/navigation";
import { LineIcon } from "@/components/ui/line-icon";

/**
 * Floating LINE Support button — pinned bottom-right of the public
 * landing page only. Sellers signed into the dashboard reach the same
 * OA from a permanent entry in the sidebar (see `DashboardSidebar`),
 * because on mobile dashboard pages the FAB kept overlapping form
 * action rows (Cancel / Save) — 911korn 2026-05-28 screenshot of the
 * product-create form, where the green pill covered the right half of
 * the row.
 *
 * The destination is taken from `NEXT_PUBLIC_SUPPORT_LINE_OA` so we
 * can change the OA target without a re-deploy. Falls back to
 * @salepage if unset.
 */
export function LineSupportFab() {
  const rawPath = usePathname() ?? "";
  const pathname = rawPath.replace(/^\/(en)(?=\/|$)/, "") || "/";
  if (pathname !== "/") return null;

  const oa = (process.env.NEXT_PUBLIC_SUPPORT_LINE_OA?.trim() || "@salepage").trim();
  const href = `https://line.me/R/ti/p/${oa.startsWith("@") ? "%40" + oa.slice(1) : oa}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="LINE Support"
      className="group fixed right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[#06C755] py-2.5 pl-2.5 pr-4 text-white shadow-[0_10px_30px_-8px_rgb(6_199_85/0.55)] transition-transform hover:-translate-y-0.5 active:scale-95 sm:right-6 lg:!bottom-6"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
    >
      <LineIcon className="size-7 rounded-lg" />
      <span className="text-[13px] font-semibold leading-none">
        แชทกับเรา
      </span>
    </a>
  );
}
