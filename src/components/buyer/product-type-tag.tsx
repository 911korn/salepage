import { Download, Recycle, Sparkles } from "lucide-react";

/**
 * Type/condition tag rendered at the top-right of every product card in
 * the marketplace + storefront grids. Single tag, picked by priority so
 * a card never gets cluttered with two competing chrome elements
 * (911korn 2026-05-27 "ทำ Tag ตาม Type Product ให้หน่อย ของใหม่ มือสอง
 * Digi · ลอง design เท่ๆ ดู"):
 *
 *   1. type === "DIGITAL"           → violet pill, "ดิจิทัล"
 *   2. condition === "PRE_OWNED"    → amber pill, "มือสอง"
 *   3. condition === "NEW"          → emerald pill, "ของใหม่"
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
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm ${className}`}
    >
      <Sparkles size={10} strokeWidth={2.5} />
      ใหม่
    </span>
  );
}
