import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, prefix, suffix, ...props }, ref) => {
    return (
      <div
        className={cn(
          "group flex h-12 items-center rounded-xl border border-[color:var(--color-border)] bg-white",
          "focus-within:border-[color:var(--color-brand-400)] focus-within:ring-2 focus-within:ring-[color:var(--color-brand-100)]",
          "transition-[border-color,box-shadow] duration-150",
          className,
        )}
      >
        {prefix ? (
          <span className="flex items-center pl-3.5 pr-1 text-sm text-[color:var(--color-muted)]">
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          className={cn(
            "h-full w-full min-w-0 flex-1 bg-transparent px-3.5 text-[15px] outline-none placeholder:text-zinc-400",
            prefix && "pl-2",
            suffix && "pr-2",
          )}
          {...props}
        />
        {suffix ? (
          <span className="flex items-center pr-3.5 pl-1 text-sm text-[color:var(--color-muted)]">
            {suffix}
          </span>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";
