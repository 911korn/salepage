import type { ComponentType } from "react";
import { OpenShop } from "./content/open-shop";
import { ShopSettings } from "./content/shop-settings";
import { AddProduct } from "./content/add-product";
import { ImportProducts } from "./content/import-products";
import { ManageOrders } from "./content/manage-orders";
import { AutoSlip } from "./content/auto-slip";
import { PrintLabelShip } from "./content/print-label-ship";
import { BulkTracking } from "./content/bulk-tracking";
import { GetPaid } from "./content/get-paid";
import { SlipCredits } from "./content/slip-credits";
import { Plans } from "./content/plans";
import { Coupons } from "./content/coupons";
import { Chat } from "./content/chat";
import { Analytics } from "./content/analytics";
import { Kyc } from "./content/kyc";
import { BuyDomain } from "./content/buy-domain";
import { RefundDispute } from "./content/refund-dispute";

/**
 * Registry of every help-topic content component, keyed by the topic slug
 * declared in `lib/help-topics.ts`. The per-topic page (`[topic]/page.tsx`)
 * does a string lookup here and renders whichever component is registered.
 *
 * Each content module is intentionally a small standalone .tsx file —
 * easy to skim, easy to swap in / out, and any future editor (human or
 * agent) can find and edit a topic without scrolling past unrelated
 * content. 911korn 2026-05-28 "ทำเมนู คู่มือ วิธีการใช้เว็บ ทุกๆ เรื่อง".
 */
export const HELP_CONTENT: Record<string, ComponentType> = {
  "open-shop": OpenShop,
  "shop-settings": ShopSettings,
  "add-product": AddProduct,
  "import-products": ImportProducts,
  "manage-orders": ManageOrders,
  "auto-slip": AutoSlip,
  "print-label-ship": PrintLabelShip,
  "bulk-tracking": BulkTracking,
  "get-paid": GetPaid,
  "slip-credits": SlipCredits,
  plans: Plans,
  coupons: Coupons,
  chat: Chat,
  analytics: Analytics,
  kyc: Kyc,
  "buy-domain": BuyDomain,
  "refund-dispute": RefundDispute,
};
