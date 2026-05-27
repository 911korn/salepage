import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Cross-shop cart store (V1.0).
 *
 * Bag is keyed by `shopSlug` so the buyer can stack items from multiple shops
 * before checking out. Each shop becomes its own Order at checkout time —
 * one PromptPay QR per shop — because every shop has its own promptpayId
 * and 0% commission flows direct to the seller's account.
 *
 * Persistence: AsyncStorage. We deliberately don't use MMKV here because
 * Zustand `persist` round-trips through JSON which AsyncStorage handles
 * natively, and the cart isn't large enough to need MMKV's perf.
 *
 * Migration: any pre-V1 cart shape is dropped on first read (`onRehydrateStorage`).
 */

export interface CartLine {
  productSlug: string;
  productName: string;
  priceSatang: number;
  imageUrl: string | null;
  qty: number;
  /**
   * Product type at add-to-cart time. Drives the checkout form
   * (digital carts ask for email instead of shipping address). Falls
   * back to PHYSICAL for legacy lines persisted before V2.1.
   */
  type?: "PHYSICAL" | "DIGITAL";
  /**
   * V2.1 per-product shipping fee in satang at add-to-cart time. The
   * cart summary takes MAX() across a shop's line items. Server re-
   * derives at order POST so this is display-only.
   */
  shippingFeeSatang?: number;
}

export interface CartShop {
  shopName: string;
  items: CartLine[];
}

interface CartState {
  /** Keyed by shopSlug. Empty object means cart is empty. */
  shops: Record<string, CartShop>;
  add: (shopSlug: string, shopName: string, line: CartLine) => void;
  setQty: (shopSlug: string, productSlug: string, qty: number) => void;
  removeLine: (shopSlug: string, productSlug: string) => void;
  removeShop: (shopSlug: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      shops: {},
      add: (shopSlug, shopName, line) => {
        const state = get();
        const existingShop = state.shops[shopSlug];
        if (!existingShop) {
          // First time we see this shop — add it with the single line.
          set({
            shops: {
              ...state.shops,
              [shopSlug]: { shopName, items: [line] },
            },
          });
          return;
        }
        const existingLine = existingShop.items.find(
          (it) => it.productSlug === line.productSlug,
        );
        const items = existingLine
          ? existingShop.items.map((it) =>
              it.productSlug === line.productSlug
                ? { ...it, qty: it.qty + line.qty }
                : it,
            )
          : [...existingShop.items, line];
        set({
          shops: {
            ...state.shops,
            [shopSlug]: { shopName, items },
          },
        });
      },
      setQty: (shopSlug, productSlug, qty) => {
        if (qty <= 0) {
          get().removeLine(shopSlug, productSlug);
          return;
        }
        set((state) => {
          const shop = state.shops[shopSlug];
          if (!shop) return state;
          return {
            shops: {
              ...state.shops,
              [shopSlug]: {
                shopName: shop.shopName,
                items: shop.items.map((it) =>
                  it.productSlug === productSlug ? { ...it, qty } : it,
                ),
              },
            },
          };
        });
      },
      removeLine: (shopSlug, productSlug) =>
        set((state) => {
          const shop = state.shops[shopSlug];
          if (!shop) return state;
          const items = shop.items.filter((it) => it.productSlug !== productSlug);
          // Drop the shop entry entirely if no lines remain.
          if (items.length === 0) {
            const next = { ...state.shops };
            delete next[shopSlug];
            return { shops: next };
          }
          return {
            shops: {
              ...state.shops,
              [shopSlug]: { shopName: shop.shopName, items },
            },
          };
        }),
      removeShop: (shopSlug) =>
        set((state) => {
          if (!state.shops[shopSlug]) return state;
          const next = { ...state.shops };
          delete next[shopSlug];
          return { shops: next };
        }),
      clear: () => set({ shops: {} }),
    }),
    {
      name: "salepage:cart:v1",
      storage: createJSONStorage(() => AsyncStorage),
      // Bump the version when the shape changes again so old carts get nuked.
      version: 1,
    },
  ),
);

// ─── Selectors ─────────────────────────────────────────────────────────────

export function selectSubtotalSatang(state: CartState): number {
  let total = 0;
  for (const shop of Object.values(state.shops)) {
    for (const it of shop.items) total += it.priceSatang * it.qty;
  }
  return total;
}

export function selectShopSubtotal(
  state: CartState,
  shopSlug: string,
): number {
  const shop = state.shops[shopSlug];
  if (!shop) return 0;
  return shop.items.reduce((sum, it) => sum + it.priceSatang * it.qty, 0);
}

export function selectItemCount(state: CartState): number {
  let count = 0;
  for (const shop of Object.values(state.shops)) {
    for (const it of shop.items) count += it.qty;
  }
  return count;
}

export function selectShopCount(state: CartState): number {
  return Object.keys(state.shops).length;
}

export interface CartShopSummary {
  shopSlug: string;
  shopName: string;
  items: CartLine[];
  subtotalSatang: number;
  /**
   * V2.1 per-shop shipping fee = MAX(item.shippingFeeSatang) across
   * physical line items. Digital-only carts ship for free.
   */
  shippingSatang: number;
}

/**
 * Convert the shops map into a list with subtotals — stable order by shopSlug
 * so re-renders are deterministic across reorderings of unrelated shops.
 *
 * Call via `useMemo(() => shopsToList(shops), [shops])` from components
 * (NOT directly as a Zustand selector). The function creates a fresh
 * array+items on every call, so using it as a selector causes Zustand
 * to see "changed" output every render and triggers an infinite loop
 * (911korn 2026-05-27 IMG_5241).
 */
export function shopsToList(
  shops: Record<string, CartShop>,
): CartShopSummary[] {
  return Object.entries(shops)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([shopSlug, shop]) => ({
      shopSlug,
      shopName: shop.shopName,
      items: shop.items,
      subtotalSatang: shop.items.reduce(
        (sum, it) => sum + it.priceSatang * it.qty,
        0,
      ),
      shippingSatang: shop.items.reduce((max, it) => {
        if (it.type === "DIGITAL") return max;
        return Math.max(max, it.shippingFeeSatang ?? 0);
      }, 0),
    }));
}

/**
 * @deprecated Use `useCart((s) => s.shops)` + `useMemo(() => shopsToList(shops), [shops])`
 * instead. This selector creates a new array on every call, which loops
 * Zustand's render cycle. Kept for backward-compat with web routes.
 */
export function selectShopList(state: CartState): CartShopSummary[] {
  return shopsToList(state.shops);
}
