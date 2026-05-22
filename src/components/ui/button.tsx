import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary:
    "bg-[color:var(--color-brand-600)] text-white hover:bg-[color:var(--color-brand-700)] active:bg-[color:var(--color-brand-800)] glow-brand",
  secondary:
    "bg-[color:var(--color-fg)] text-white hover:bg-zinc-800 active:bg-zinc-900",
  ghost:
    "bg-transparent text-[color:var(--color-fg)] hover:bg-[color:var(--color-soft)] active:bg-zinc-100",
  outline:
    "bg-white text-[color:var(--color-fg)] border border-[color:var(--color-border)] hover:border-[color:var(--color-brand-300)] hover:bg-[color:var(--color-brand-50)] active:bg-[color:var(--color-brand-100)]",
  danger:
    "bg-white text-[color:var(--color-brand-700)] border border-[color:var(--color-brand-200)] hover:bg-[color:var(--color-brand-50)]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-[15px] rounded-xl gap-2",
  lg: "h-13 px-6 text-base rounded-xl gap-2",
  xl: "h-14 px-7 text-base rounded-2xl gap-2",
};

export function buttonStyles(
  options: { variant?: Variant; size?: Size; className?: string } = {},
) {
  const { variant = "primary", size = "md", className } = options;
  return cn(
    "inline-flex items-center justify-center font-medium tracking-tight whitespace-nowrap",
    "transition-[transform,background-color,border-color,box-shadow] duration-150",
    "outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--color-ring)]",
    "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
    "active:scale-[0.985]",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled ?? loading}
        className={buttonStyles({ variant, size, className })}
        {...props}
      >
        {loading ? (
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
