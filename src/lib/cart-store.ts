"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Web cart store — mirrors the mobile Zustand shape in
 * `mobile/src/store/cart.ts` so server-side order POSTs can reuse the same
 * payload shape. Persisted to `localStorage` under `salepage:cart:v1`.
 *
 * Why a separate store from mobile: the web is a server-rendered Next.js
 * app, mobile is React Native. Code can't be physically shared, but the
 * shape can — keep them in lockstep when adding fields.
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
   * cart summary takes MAX() across a shop's line items — one parcel,
   * one shipping fee. Server re-derives this from product data at
   * order POST so the cart value is display-only.
   */
  shippingFeeSatang?: number;
}

export interface CartShop {
  shopName: string;
  items: CartLine[];
}

interface CartState {
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
        const existing = state.shops[shopSlug];
        if (!existing) {
          set({
            shops: {
              ...state.shops,
              [shopSlug]: { shopName, items: [line] },
            },
          });
          return;
        }
        const existingLine = existing.items.find(
          (it) => it.productSlug === line.productSlug,
        );
        const items = existingLine
          ? existing.items.map((it) =>
              it.productSlug === line.productSlug
                ? { ...it, qty: it.qty + line.qty }
                : it,
            )
          : [...existing.items, line];
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
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          // SSR — no localStorage. Return a no-op store so the persist
          // middleware can dry-instantiate. Browser hydrate replaces it.
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
      version: 1,
    },
  ),
);

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

export function selectSubtotalSatang(state: CartState): number {
  let total = 0;
  for (const shop of Object.values(state.shops)) {
    for (const it of shop.items) total += it.priceSatang * it.qty;
  }
  return total;
}

export interface CartShopSummary {
  shopSlug: string;
  shopName: string;
  items: CartLine[];
  subtotalSatang: number;
  /**
   * V2.1 per-shop shipping fee = MAX(item.shippingFeeSatang) across
   * physical line items. Digital-only carts ship for free. One parcel
   * per shop = one shipping fee regardless of qty / number of items.
   */
  shippingSatang: number;
}

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
