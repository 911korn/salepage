import { cn } from "@/lib/cn";

interface LogoMarkProps {
  className?: string;
  /** Tailwind size classes for the wrapper, default size-9. */
  size?: string;
  /** Add a soft glow ring (useful on light hero backgrounds). */
  glow?: boolean;
}

/**
 * SalePage logo mark — "Folded Sale Tag with S-stroke"
 *
 * - Pentagon price-tag silhouette (top-left corner is folded inward, pointing
 *   to the right — reads as a literal "page" that is also a "sale tag").
 * - Inner S-curve in white traces the path of a transaction (in-out flow).
 * - Punch-hole dot in the folded corner = classic price-tag string hole;
 *   doubles as a "live / online" status indicator at small sizes.
 * - Gradient: rose-400 → brand-600 → rose-800, set diagonally so the mark
 *   looks 3-dimensional at any size.
 */
export function LogoMark({ className, size = "size-9", glow }: LogoMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-grid place-items-center",
        size,
        glow && "drop-shadow-[0_8px_24px_rgba(225,29,72,0.35)]",
        className,
      )}
    >
      <svg
        viewBox="0 0 40 40"
        fill="none"
        className="size-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="sp-grad" x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="55%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#9f1239" />
          </linearGradient>
          <linearGradient id="sp-fold" x1="14" y1="6" x2="6" y2="14" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffe4e6" />
            <stop offset="100%" stopColor="#fda4af" />
          </linearGradient>
        </defs>

        {/* Folded sale-tag silhouette */}
        <path
          d="M14 6 L34 6 A2 2 0 0 1 36 8 L36 34 A2 2 0 0 1 34 36 L6 36 A2 2 0 0 1 4 34 L4 16 Z"
          fill="url(#sp-grad)"
        />

        {/* The folded corner (top-left triangle) */}
        <path
          d="M14 6 L4 16 L14 16 A0 0 0 0 0 14 16 Z"
          fill="url(#sp-fold)"
        />
        <path d="M14 6 L4 16 L14 16 Z" fill="url(#sp-fold)" />

        {/* Punch-hole dot in the fold (price-tag thread hole) */}
        <circle cx="10" cy="13" r="1.4" fill="#9f1239" opacity="0.85" />

        {/* S-stroke (the "Sale" flow line) */}
        <path
          d="M25 15.5 H19.5 C17.6 15.5 16 17.1 16 19 C16 20.9 17.6 22.5 19.5 22.5 H23.5 C25.4 22.5 27 24.1 27 26 C27 27.9 25.4 29.5 23.5 29.5 H17.5"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Live spark dot at the end of S — also a "new order" pulse */}
        <circle cx="17.5" cy="29.5" r="1.6" fill="white" />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-lg font-bold tracking-tight",
        className,
      )}
    >
      Sale<span className="text-[color:var(--color-brand-600)]">Page</span>
    </span>
  );
}

export function LogoLockup({
  size,
  glow,
  className,
}: LogoMarkProps & { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark size={size} glow={glow} />
      <Wordmark />
    </span>
  );
}
