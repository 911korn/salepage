/**
 * API response shapes — mirror src/lib/api.ts on the Next.js side.
 *
 * Keep this file dependency-free so it can be share-imported into web later
 * (we already alias `../src/types/api` from the web side if needed).
 */

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Domain types (subset; expand as endpoints come online) ────────────────

export type ProductBadge = "HOT" | "NEW" | "SALE";
export type ProductType = "PHYSICAL" | "DIGITAL";
export type ProductCondition = "NEW" | "PRE_OWNED";
export type ProductStatus = "ACTIVE" | "HIDDEN" | "SOLD_OUT";
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";
export type KycStatus = "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
export type LiveBroadcastStatus =
  | "SCHEDULED"
  | "LIVE"
  | "ENDED"
  | "CANCELLED";
export type EscrowStatus = "HELD" | "RELEASED" | "REFUNDED" | "DISPUTED";
export type GroupBuyStatus = "ACTIVE" | "FILLED" | "EXPIRED" | "CANCELLED";

export interface PriceTier {
  minQty: number;
  priceSatang: number;
}

/**
 * V2.0 Group Buy public summary. Used by the shop page rail + product page
 * banner. Includes the current price + the immediate next-tier hint so the
 * "เหลืออีก X ชิ้น ลดเหลือ Y ฿" copy can render without extra fetches.
 */
export interface GroupBuySummary {
  id: string;
  title: string;
  description: string | null;
  status: GroupBuyStatus;
  minQty: number;
  maxQty: number | null;
  currentQty: number;
  tiers: PriceTier[];
  currentPriceSatang: number;
  nextTier: PriceTier | null;
  deadline: string;
  filledAt: string | null;
  expiredAt: string | null;
  product: {
    slug: string;
    name: string;
    description?: string | null;
    priceSatang: number;
    imageUrls: string[];
  };
  shop?: {
    slug: string;
    name: string;
    logoText: string | null;
    logoUrl: string | null;
    themeColor: string;
    kycStatus: KycStatus;
  };
}

/**
 * Compact summary used by the discovery feed + per-shop live list. Detail
 * payloads (with rtcSubscribeToken etc.) live inline at the call site.
 */
export interface LiveBroadcastSummary {
  id: string;
  title: string;
  coverImageUrl: string | null;
  status: LiveBroadcastStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  viewerCount: number;
  pinnedProductSlug: string | null;
  shop: {
    id: string;
    slug: string;
    name: string;
    logoText: string | null;
    logoUrl: string | null;
    themeColor: string;
    kycStatus: KycStatus;
  };
}

export interface ShopSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoText: string | null;
  logoUrl: string | null;
  bannerUrls: string[];
  category: string | null;
  themeColor: string;
  /** @deprecated use kycStatus === "VERIFIED" */
  verified: boolean;
  kycStatus: KycStatus;
  trustScore: number;
  rating: number;
  totalSold: number;
  contact: {
    phone?: string | null;
    line?: string | null;
    facebook?: string | null;
  } | null;
  announcement: string | null;
  /**
   * V1.6 trust signal — public 90-day dispute stats. Only populated by the
   * shop GET endpoint; feed/list endpoints omit this for performance.
   */
  disputeStats?: {
    count: number;
    deliveredCount: number;
    /** Disputes / delivered ratio as a percentage with 1 decimal. */
    ratePct: number;
    windowDays: number;
  };
  /**
   * V1.5 Protected Pay opt-in. Shop owners can disable in /seller/settings.
   * When false, the checkout toggle is hidden + the shop badge isn't shown.
   */
  acceptsEscrow?: boolean;
  /**
   * V2.1 follower social proof — count of users following this shop and
   * the current viewer's follow state. Only populated by the per-shop
   * GET; list endpoints omit them.
   */
  followerCount?: number;
  isFollowing?: boolean;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceSatang: number;
  compareAtSatang: number | null;
  imageUrls: string[];
  badge: ProductBadge | null;
  type: ProductType;
  category: string | null;
  condition: ProductCondition;
  stock: number | null;
  sold: number;
  status: ProductStatus;
}

export interface ShopWithProducts {
  shop: ShopSummary;
  products: ProductSummary[];
}

export interface OrderItemSnapshot {
  productSlug: string;
  productName: string;
  qty: number;
  priceSatang: number;
  image?: string;
}

export interface OrderDetail {
  // NOTE: shape mirrors GET /api/v1/orders/:token (see
  // src/app/api/v1/orders/[token]/route.ts on the web side). When the web
  // route changes, update this and the consumers will get type errors.
  publicToken: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  lineLinked: boolean;
  customerLineDisplayName: string | null;
  customerLinePictureUrl: string | null;
  items: OrderItemSnapshot[];
  subtotalSatang: number;
  shippingSatang: number;
  totalSatang: number;
  slipRef: string | null;
  slipVerifiedAt: string | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  /**
   * V1.5 Protected Pay summary — mirrors EscrowHold on the server. Null
   * if the order didn't opt in. Used by the tracking screen to render the
   * "ยืนยันได้รับสินค้า" CTA + the protected-pay shield banner.
   */
  useEscrow: boolean;
  escrowFeeSatang: number;
  buyerConfirmedAt: string | null;
  escrow: {
    status: EscrowStatus;
    amountSatang: number;
    feeSatang: number;
    scheduledReleaseAt: string | null;
    closeReason: string | null;
  } | null;
  shop: {
    slug: string;
    name: string;
    logoText: string | null;
    themeColor: string;
    promptpayId: string | null;
    contact: { phone?: string | null; line?: string | null; facebook?: string | null } | null;
  };
  qr: { dataUrl: string; payload: string; amount: number } | null;
}

export interface CreateOrderResponse {
  orderId: string;
  token: string;
  trackingUrl: string;
  qr: { dataUrl: string; payload: string; amount: number } | null;
}

export interface SlipVerifyResponse {
  verified: boolean;
  ref?: string;
  amount?: number;
  errorCode?: "provider_rejected" | "provider_error" | "receiver_unreadable";
  errorMessage?: string;
}
