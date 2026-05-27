import { Download, Recycle } from "lucide-react";

/**
 * Type/condition tag rendered at the top-right of every product card in
 * the marketplace + storefront grids. Renders ONLY for the two non-
 * default cases — Digital and PRE_OWNED. Regular new physical
 * products get nothing, because every common product was getting a
 * loud "ใหม่" pill that competed with the HOT/NEW badge on the same
 * card. 911korn 2026-05-27 "UI มันเพี้ยน".
 *
 *   1. type === "DIGITAL"           → violet pill, "ดิจิทัล"
 *   2. condition === "PRE_OWNED"    → amber pill, "มือสอง"
 *   3. else                         → null (the card stays clean)
 *
 * Pills use Lucide icons (NOT emoji per the CET no-emoji rule),
 * solid colored fill at 95% opacity so they pop over photos without
 * blowing out the image, white text + crisp 1.2px stroke icon.
 */
export function ProductTypeTag({
  type,
  condition,
  className = "",
}: {
  type: "PHYSICAL" | "DIGITAL";
  condition: "NEW" | "PRE_OWNED";
  className?: string;
}) {
  if (type === "DIGITAL") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-violet-600/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm ${className}`}
      >
        <Download size={10} strokeWidth={2.5} />
        ดิจิทัล
      </span>
    );
  }
  if (condition === "PRE_OWNED") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm ${className}`}
      >
        <Recycle size={10} strokeWidth={2.5} />
        มือสอง
      </span>
    );
  }
  return null;
}
