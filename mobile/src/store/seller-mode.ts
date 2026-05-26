import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Buyer ↔ Seller mode toggle. Persisted across launches so a shop owner
 * doesn't have to re-flip every time they open the app, but defaults to
 * BUYER for clean install (most users are buyers first).
 *
 * The "active shop" is the slug the seller dashboard is currently filtered
 * to — set when a shop is picked from the shop list. Multiple owned shops
 * are supported but only one is active in the dashboard at a time.
 */
type Mode = "buyer" | "seller";

interface SellerModeState {
  mode: Mode;
  activeShopSlug: string | null;
  setMode: (mode: Mode) => void;
  setActiveShop: (slug: string | null) => void;
}

export const useSellerMode = create<SellerModeState>()(
  persist(
    (set) => ({
      mode: "buyer",
      activeShopSlug: null,
      setMode: (mode) => set({ mode }),
      setActiveShop: (slug) => set({ activeShopSlug: slug }),
    }),
    {
      name: "salepage:seller-mode",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
