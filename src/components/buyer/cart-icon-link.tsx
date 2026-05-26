"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart, selectItemCount } from "@/lib/cart-store";

/**
 * Small cart-icon link with item-count badge. Drop-in for any header
 * that wants buyer-flow continuity but doesn't render the full BuyerNav
 * (e.g. the /s/[slug] storefront page, which has its own header).
 */
export function CartIconLink({
  className = "",
}: {
  className?: string;
}) {
  const itemCount = useCart(selectItemCount);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showBadge = mounted && itemCount > 0;
  return (
    <Link
      href="/cart"
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-700 hover:bg-[color:var(--color-soft)] ${className}`}
      aria-label="View cart"
    >
      <ShoppingBag size={18} />
      {showBadge ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-[color:var(--color-brand)] px-1 text-[10px] font-bold text-white">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </Link>
  );
}
