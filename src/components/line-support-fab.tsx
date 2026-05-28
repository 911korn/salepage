"use client";

import { usePathname } from "next/navigation";
import { LineIcon } from "@/components/ui/line-icon";

/**
 * Floating LINE Support button — pinned bottom-right of seller-facing
 * surfaces only (home page + dashboard). It exists so a prospective
 * seller browsing the landing page or a signed-in seller in their
 * dashboard can tap and chat with the SalePage team.
 *
 * 911korn 2026-05-28 "เอาปุ่ม LINE Support ออกจากหน้า Shop หน่อย คับ
 * เอาไว้แค่หลังบ้าน กับ Home Page พอ ไว้ให้ Seller ติดต่อเรา" — on a
 * shop storefront / order / cart / buyer page, this button competes
 * with the shop's own LINE OA (the buyer should chat with the SHOP,
 * not with SalePage support).
 *
 * The destination is taken from `NEXT_PUBLIC_SUPPORT_LINE_OA` so we
 * can change the OA target without a re-deploy. Falls back to
 * @salepage if unset.
 */
export function LineSupportFab() {
  const rawPath = usePathname() ?? "";
  // Strip the optional `/en` locale prefix so the route match below
  // doesn't need to be repeated for each locale.
  const pathname = rawPath.replace(/^\/(en)(?=\/|$)/, "") || "/";
  const isHome = pathname === "/";
  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  if (!isHome && !isDashboard) return null;

  const oa = (process.env.NEXT_PUBLIC_SUPPORT_LINE_OA?.trim() || "@salepage").trim();
  const href = `https://line.me/R/ti/p/${oa.startsWith("@") ? "%40" + oa.slice(1) : oa}`;
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
