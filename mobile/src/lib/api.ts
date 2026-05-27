import { getEnv } from "@/lib/env";
import { getAuthToken } from "@/lib/auth";
import type {
  ApiResponse,
  CreateOrderResponse,
  GroupBuyStatus,
  GroupBuySummary,
  KycStatus,
  LiveBroadcastStatus,
  LiveBroadcastSummary,
  OrderDetail,
  ShopSummary,
  ShopWithProducts,
  SlipVerifyResponse,
} from "@/types/api";

/**
 * Typed REST client for `/api/v1/*`.
 *
 * Convention: every server response is `{ ok: true, data }` | `{ ok: false, error }`.
 * `apiFetch` unwraps `data` on success and throws `ApiClientError` otherwise so
 * call sites stay flat.
 */

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip the auth header even if a token exists. */
  anonymous?: boolean;
  /** Multipart form data — pass FormData directly. */
  formData?: FormData;
  signal?: AbortSignal;
}

async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const env = getEnv();
  const url = new URL(path.startsWith("/") ? path : `/${path}`, env.apiBaseUrl);
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (!opts.anonymous) {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
    // Don't set Content-Type — fetch sets the multipart boundary.
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body,
    signal: opts.signal,
  });

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      `เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON (${res.status})`,
      "invalid_response",
      res.status,
    );
  }

  if (json.ok) return json.data;
  throw new ApiClientError(
    json.error.message,
    json.error.code,
    res.status,
    json.error.details,
  );
}

/**
 * Affiliate payout history row — shared between `me.earnings` and `me.payouts`
 * responses so the mobile UI can render the payouts feed in either query.
 */
export interface MePayout {
  id: string;
  amountSatang: number;
  promptpayId: string;
  status:
    | "REQUESTED"
    | "APPROVED"
    | "PAID"
    | "REJECTED"
    | "CANCELLED"
    | string;
  providerRef: string | null;
  rejectedReason: string | null;
  paidAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// ─── Endpoint wrappers ────────────────────────────────────────────────────

export const api = {
  health: () => apiFetch<{ name: string; version: string; time: string }>("/api/v1/health", { anonymous: true }),

  shop: {
    get: (slug: string) => apiFetch<ShopWithProducts>(`/api/v1/shops/${slug}`, { anonymous: true }),
  },

  orders: {
    create: (input: {
      shopSlug: string;
      items: Array<{ productSlug: string; qty: number }>;
      customerName: string;
      customerPhone?: string;
      customerEmail?: string;
      customerAddress?: string;
      notes?: string;
      shippingSatang?: number;
      couponCode?: string;
      redeemPoints?: number;
      lineIdToken?: string;
      /** V1.5 affiliate attribution — captured by deep-link handler. */
      referrerUserId?: string;
      referrerCode?: string;
      /** V1.5 Protected Pay opt-in — adds 1.5% buyer-paid fee. */
      useEscrow?: boolean;
      // NOT anonymous: when the buyer is signed-in, attach the Bearer JWT so
      // the server can tag the Order with their email (→ /me/orders surfaces
      // the pending PromptPay order on the Orders tab). Anonymous checkout
      // still works because the helper only sends the header when a token
      // exists (911korn 2026-05-27 IMG_5250 "Order ที่ยังไม่ได้จ่ายหาไม่เจอ").
    }) => apiFetch<CreateOrderResponse>("/api/v1/orders", { method: "POST", body: input }),

    /**
     * V1.0 multi-shop checkout — creates one Order per shop in a single
     * transaction and returns a list of {token, qr} for the cart UI to render
     * one tab/QR per shop.
     */
    createMulti: (input: {
      customerName: string;
      customerPhone?: string;
      customerEmail?: string;
      customerAddress?: string;
      shops: Array<{
        shopSlug: string;
        items: Array<{ productSlug: string; qty: number }>;
        notes?: string;
        /** V1.5 Protected Pay opt-in per-shop. */
        useEscrow?: boolean;
        /** V1.1 per-shop coupon (silently ignored when invalid). */
        couponCode?: string;
        /** V1.1 per-shop loyalty points; requires top-level `customerPhone`. */
        redeemPoints?: number;
      }>;
      lineIdToken?: string;
      /** V1.6 affiliate attribution — same as single-shop. */
      referrerUserId?: string;
      referrerCode?: string;
    }) =>
      apiFetch<{
        orders: Array<{
          shopSlug: string;
          shopName: string;
          orderId: string;
          token: string;
          trackingUrl: string;
          totalSatang: number;
          qr: { dataUrl: string; payload: string; amount: number } | null;
        }>;
        grandTotalSatang: number;
      }>("/api/v1/orders/multi", { method: "POST", body: input }),

    get: (token: string) => apiFetch<OrderDetail>(`/api/v1/orders/${token}`, { anonymous: true }),

    /**
     * V1.5 Protected Pay: buyer presses "ยืนยันได้รับสินค้า" on the tracking screen.
     * Releases the EscrowHold to the shop immediately (no 72h wait).
     * Idempotent — calling on an already-released escrow returns success.
     */
    confirmReceived: (token: string) =>
      apiFetch<{
        released: boolean;
        alreadyReleased: boolean;
        buyerConfirmedAt?: string | null;
      }>(`/api/v1/orders/${token}/confirm-received`, {
        method: "POST",
        anonymous: true,
      }),

    /**
     * V1.6: list any disputes the buyer opened on this order. Public, scoped
     * by token. Returns empty array if no disputes — easier on the UI than
     * branching on null vs []. 
     */
    listDisputes: (token: string) =>
      apiFetch<{
        disputes: Array<{
          id: string;
          reason: string;
          description: string;
          evidence: Array<{ kind: "image" | "text"; value: string }>;
          status: string;
          resolution: string | null;
          resolvedAt: string | null;
          createdAt: string;
          updatedAt: string;
        }>;
      }>(`/api/v1/orders/${token}/disputes`, { anonymous: true }),

    /** Open a new dispute on a paid/shipping/delivered order. */
    openDispute: (
      token: string,
      input: {
        reason:
          | "NOT_RECEIVED"
          | "WRONG_ITEM"
          | "DAMAGED"
          | "NOT_AS_DESCRIBED"
          | "PAYMENT_ISSUE"
          | "OTHER";
        description: string;
        evidence?: Array<{ kind: "image" | "text"; value: string }>;
      },
    ) =>
      apiFetch<{
        dispute: {
          id: string;
          status: string;
          createdAt: string;
        };
      }>(`/api/v1/orders/${token}/disputes`, {
        method: "POST",
        body: input,
        anonymous: true,
      }),

    /**
     * Public cancel — allowed only while the order is PENDING. Used by the
     * "ยกเลิกคำสั่งซื้อ" link on the checkout screen so a buyer who picked
     * the wrong shop can drop the order immediately instead of waiting on
     * the 7-day auto-expiry cron.
     */
    cancel: (token: string, opts?: { reason?: string }) =>
      apiFetch<{ status: string }>(`/api/v1/orders/${token}/cancel`, {
        method: "POST",
        body: opts?.reason ? { reason: opts.reason } : undefined,
        anonymous: true,
      }),

    /**
     * Seller-only: update an order's status. Requires Bearer JWT of the shop
     * owner. The backend enforces ALLOWED_NEXT transitions so we can't go
     * e.g. PENDING → DELIVERED in one shot.
     */
    setStatus: (
      token: string,
      status: "PAID" | "SHIPPING" | "DELIVERED" | "CANCELLED",
    ) =>
      apiFetch<{ status: string }>(`/api/v1/orders/${token}/status`, {
        method: "PATCH",
        body: { status },
      }),

    /**
     * Seller-only: flip the order to SHIPPING + optionally record the
     * tracking number / courier code. The backend triggers
     * `notifyOrderShipping` push for the buyer.
     */
    markShipping: (
      token: string,
      input: {
        trackingNumber?: string;
        courierCode?: string;
        courierName?: string;
      } = {},
    ) =>
      apiFetch<{
        status: string;
        trackingNumber: string | null;
      }>(`/api/v1/orders/${token}/shipment`, {
        method: "POST",
        body: { ...input, markShipping: true },
      }),

    /**
     * The server expects a JSON body `{ imageBase64 }` (NOT multipart) — the
     * same payload shape the web side uses. Caller has already compressed the
     * image with `compressForSlipUpload()` so we ship ~200 KB instead of the
     * 5–10 MB the phone camera returns by default.
     */
    verifySlip: (token: string, imageBase64: string) =>
      apiFetch<SlipVerifyResponse>(`/api/v1/orders/${token}/slip`, {
        method: "POST",
        body: { imageBase64 },
        anonymous: true,
      }),

    verifyQrPayload: (token: string, qrPayload: string) =>
      apiFetch<SlipVerifyResponse>(`/api/v1/orders/${token}/slip`, {
        method: "POST",
        body: { qrPayload },
        anonymous: true,
      }),
  },

  auth: {
    /// Exchange a LINE id_token (from native LINE Login SDK) for a SalePage JWT.
    lineMobile: (idToken: string) =>
      apiFetch<{
        token: string;
        expiresAt: string;
        userId: string;
        user: { id: string; name: string | null; email: string; image: string | null };
      }>("/api/v1/auth/line-mobile", {
        method: "POST",
        body: { idToken },
        anonymous: true,
      }),

    /// Exchange a Google id_token (from native Google OAuth PKCE) for a SalePage JWT.
    /// Same user row as Auth.js's Google provider on the web — both find/
    /// create by lower-cased email.
    googleMobile: (idToken: string) =>
      apiFetch<{
        token: string;
        expiresAt: string;
        userId: string;
        user: { id: string; name: string | null; email: string; image: string | null };
      }>("/api/v1/auth/google-mobile", {
        method: "POST",
        body: { idToken },
        anonymous: true,
      }),

    /// Refresh JWT — must include current Bearer token in Authorization header.
    refresh: () =>
      apiFetch<{ token: string; expiresAt: string; userId: string }>("/api/v1/auth/refresh", {
        method: "POST",
      }),

    /// Inline email OTP — send a 6-digit code to the user's email.
    /// Same User row as the web Auth.js Resend magic-link flow + the
    /// Google/LINE bridges (find-or-create by lower-cased email).
    emailOtpSend: (email: string) =>
      apiFetch<{ sent: true; expiresAt: string }>("/api/v1/auth/email-otp/send", {
        method: "POST",
        body: { email },
        anonymous: true,
      }),

    /// Verify a 6-digit code that was sent via emailOtpSend.
    emailOtpVerify: (email: string, code: string) =>
      apiFetch<{
        token: string;
        expiresAt: string;
        userId: string;
        user: { id: string; name: string | null; email: string; image: string | null };
      }>("/api/v1/auth/email-otp/verify", {
        method: "POST",
        body: { email, code },
        anonymous: true,
      }),
  },

  me: {
    registerPushToken: (token: string) =>
      apiFetch<{ registered: true }>("/api/v1/me/push-token", {
        method: "POST",
        body: { token },
      }),
    unregisterPushToken: () =>
      apiFetch<{ cleared: true }>("/api/v1/me/push-token", {
        method: "DELETE",
      }),

    // V1 marketplace endpoints (backend stubs come next).
    profile: () =>
      apiFetch<{
        id: string;
        name: string | null;
        email: string;
        image: string | null;
        favoriteCount: number;
        followingCount: number;
        orderCount: number;
      }>("/api/v1/me"),

    orders: (opts?: { status?: string; cursor?: string }) =>
      apiFetch<{
        orders: Array<{
          token: string;
          status: string;
          shopName: string;
          shopSlug: string;
          totalSatang: number;
          createdAt: string;
        }>;
        counts: Record<string, number>;
        nextCursor: string | null;
      }>("/api/v1/me/orders", {
        query: { status: opts?.status, cursor: opts?.cursor },
      }),

    favorites: () =>
      apiFetch<{ shops: ShopSummary[] }>("/api/v1/me/favorites"),

    /**
     * V1.6: cross-shop loyalty wallet aggregator. Returns one entry per
     * shop where the user has > 0 points, plus a `totals` block for the
     * header card.
     */
    wallet: () =>
      apiFetch<{
        wallets: Array<{
          shop: {
            id: string;
            slug: string;
            name: string;
            logoText: string | null;
            logoUrl: string | null;
            themeColor: string;
            loyaltyBahtPerPoint: number;
            loyaltyBahtValuePerPoint: number;
          };
          customerPhone: string;
          points: number;
          totalSpentSatang: number;
          config: { bahtPerPoint: number; bahtValuePerPoint: number };
        }>;
        totals: {
          totalPoints: number;
          totalSpentSatang: number;
          shopCount: number;
        };
      }>("/api/v1/me/wallet"),

    /**
     * V1.6: affiliate earnings rollup. Default rate is 2% but each shop can
     * override via `Shop.affiliateRatePct`. Includes a `balance` block driving
     * the request-payout CTA and a `payouts` history feed.
     */
    earnings: () =>
      apiFetch<{
        rate: { pct: number };
        balance: {
          payableSatang: number;
          reservedSatang: number;
          pendingSatang: number;
          lifetimePaidSatang: number;
          lifetimeGrossSatang: number;
          buckets: {
            pending: { count: number; grossSatang: number; commissionSatang: number };
            paid: { count: number; grossSatang: number; commissionSatang: number };
            cancelled: { count: number; grossSatang: number; commissionSatang: number };
          };
        };
        buckets: {
          pending: { count: number; grossSatang: number; commissionSatang: number };
          paid: { count: number; grossSatang: number; commissionSatang: number };
          cancelled: { count: number; grossSatang: number; commissionSatang: number };
        };
        lifetime: {
          grossSatang: number;
          commissionSatang: number;
          orderCount: number;
        };
        recent: Array<{
          orderId: string;
          token: string;
          status: string;
          totalSatang: number;
          commissionSatang: number;
          shop: {
            id: string;
            slug: string;
            name: string;
            logoText: string | null;
            themeColor: string;
          };
          referrerCode: string | null;
          createdAt: string;
          bucket: "pending" | "paid" | "cancelled";
        }>;
        payouts: Array<MePayout>;
      }>("/api/v1/me/earnings"),

    /** V1.6.1: list affiliate payout history (cap 50). */
    payouts: () =>
      apiFetch<{ payouts: MePayout[] }>("/api/v1/me/payouts"),

    /**
     * V1.6.1: request a new affiliate payout. Server validates that
     * `amountSatang` is ≥ 50฿ and ≤ payable balance; admin reviews in
     * `/admin/payouts`.
     */
    requestPayout: (input: { amountSatang: number; promptpayId: string }) =>
      apiFetch<{
        payout: {
          id: string;
          amountSatang: number;
          promptpayId: string;
          status: string;
          createdAt: string;
        };
      }>("/api/v1/me/payouts", { method: "POST", body: input }),

    /**
     * V1.5: cross-shop address book derived from past orders. Read-only V1 —
     * tap an address in checkout to autofill. Future: dedicated UserAddress
     * table with labels + default flag.
     */
    addresses: () =>
      apiFetch<{
        addresses: Array<{
          id: string;
          name: string;
          phone: string | null;
          address: string;
          lastUsedAt: string;
          lastShop: { slug: string; name: string };
        }>;
      }>("/api/v1/me/addresses"),

    /**
     * V1: followed shops with per-shop notification preferences. Used by the
     * `/me/notifications` settings screen.
     */
    following: () =>
      apiFetch<{
        follows: Array<{
          shopId: string;
          shop: {
            id: string;
            slug: string;
            name: string;
            logoText: string | null;
            logoUrl: string | null;
            themeColor: string;
            category: string | null;
          };
          notifyNew: boolean;
          notifyLive: boolean;
          notifySale: boolean;
          followedAt: string;
        }>;
      }>("/api/v1/me/following"),

    /**
     * V1.5: shops the current user owns. Used by the KYC + (future) seller
     * dashboard entry points. Web has the same data via `/api/v1/shops`.
     */
    shops: () =>
      apiFetch<{
        shops: Array<{
          id: string;
          slug: string;
          name: string;
          logoText: string | null;
          logoUrl: string | null;
          themeColor: string;
          kycStatus: "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
          trustScore: number;
        }>;
      }>("/api/v1/shops"),

    updateFollowPrefs: (input: {
      shopId: string;
      notifyNew?: boolean;
      notifyLive?: boolean;
      notifySale?: boolean;
    }) =>
      apiFetch<{
        shopId: string;
        notifyNew: boolean;
        notifyLive: boolean;
        notifySale: boolean;
      }>("/api/v1/me/following", { method: "PATCH", body: input }),
  },

  /**
   * V2 Stories — 24h ephemeral posts. Rail shown above the feed; tapping
   * a circle opens the viewer for that shop.
   */
  stories: {
    list: () =>
      apiFetch<{
        shops: Array<{
          shop: {
            id: string;
            slug: string;
            name: string;
            logoText: string | null;
            logoUrl: string | null;
            themeColor: string;
            kycStatus: KycStatus;
          };
          stories: Array<{
            id: string;
            mediaUrl: string;
            mediaKind: "IMAGE" | "VIDEO";
            caption: string | null;
            linkProductSlug: string | null;
            linkUrl: string | null;
            viewCount: number;
            createdAt: string;
            expiresAt: string;
          }>;
        }>;
      }>("/api/v1/stories", { anonymous: true }),

    forShop: (slug: string) =>
      apiFetch<{
        stories: Array<{
          id: string;
          mediaUrl: string;
          mediaKind: "IMAGE" | "VIDEO";
          caption: string | null;
          linkProductSlug: string | null;
          linkUrl: string | null;
          viewCount: number;
          createdAt: string;
          expiresAt: string;
        }>;
      }>(`/api/v1/shops/${slug}/stories`, { anonymous: true }),

    /** Owner-only: post a new 24h story. */
    create: (
      slug: string,
      input: {
        mediaUrl: string;
        mediaKind?: "IMAGE" | "VIDEO";
        caption?: string;
        linkProductSlug?: string;
        linkUrl?: string;
      },
    ) =>
      apiFetch<{
        story: {
          id: string;
          mediaUrl: string;
          mediaKind: "IMAGE" | "VIDEO";
          caption: string | null;
          expiresAt: string;
          createdAt: string;
        };
      }>(`/api/v1/shops/${slug}/stories`, { method: "POST", body: input }),

    /** Anonymous best-effort view bump. */
    markViewed: (slug: string, id: string) =>
      apiFetch<{ bumped: boolean }>(
        `/api/v1/shops/${slug}/stories/${id}/view`,
        { method: "POST", anonymous: true },
      ),
  },

  /**
   * V2.0 Live Shopping. Provider-agnostic — the server hands the mobile
   * client an opaque `rtcSubscribeToken` which the future video SDK will
   * use to connect. For V2.0 scaffolding the watch screen renders a poster
   * + comments overlay only.
   */
  live: {
    /** Public discovery: currently-live + upcoming-in-24h. */
    list: () =>
      apiFetch<{
        live: LiveBroadcastSummary[];
        upcoming: LiveBroadcastSummary[];
      }>("/api/v1/live", { anonymous: true }),

    /** Per-shop list — owner sees ENDED rows too. */
    forShop: (slug: string) =>
      apiFetch<{
        broadcasts: Array<{
          id: string;
          title: string;
          description: string | null;
          coverImageUrl: string | null;
          status: LiveBroadcastStatus;
          scheduledAt: string | null;
          startedAt: string | null;
          endedAt: string | null;
          viewerCount: number;
          totalViews: number;
          pinnedProductSlug: string | null;
          replayUrl: string | null;
        }>;
      }>(`/api/v1/shops/${slug}/live`, { anonymous: true }),

    /** Owner-only: schedule a new broadcast. */
    create: (
      slug: string,
      input: {
        title: string;
        description?: string;
        coverImageUrl?: string;
        scheduledAt?: string;
        pinnedProductSlug?: string;
      },
    ) =>
      apiFetch<{
        broadcast: {
          id: string;
          title: string;
          status: LiveBroadcastStatus;
          scheduledAt: string | null;
          rtcProvider: string | null;
          rtcChannelId: string | null;
          rtcPublishToken: string | null;
          rtcSubscribeToken: string | null;
          playbackUrl: string | null;
          createdAt: string;
        };
      }>(`/api/v1/shops/${slug}/live`, { method: "POST", body: input }),

    /** Public watch detail. */
    get: (id: string) =>
      apiFetch<{
        broadcast: {
          id: string;
          title: string;
          description: string | null;
          coverImageUrl: string | null;
          status: LiveBroadcastStatus;
          scheduledAt: string | null;
          startedAt: string | null;
          endedAt: string | null;
          viewerCount: number;
          totalViews: number;
          pinnedProductSlug: string | null;
          replayUrl: string | null;
          rtcProvider: string | null;
          rtcChannelId: string | null;
          rtcSubscribeToken: string | null;
          playbackUrl: string | null;
          shop: {
            id: string;
            slug: string;
            name: string;
            logoText: string | null;
            logoUrl: string | null;
            themeColor: string;
            kycStatus: KycStatus;
            trustScore: number;
          };
        };
        pinnedProduct: {
          slug: string;
          name: string;
          priceSatang: number;
          compareAtSatang: number | null;
          imageUrls: string[];
        } | null;
      }>(`/api/v1/live/${id}`, { anonymous: true }),

    /** Owner-only lifecycle transitions. */
    transition: (
      id: string,
      input:
        | { action: "start" }
        | { action: "end" }
        | { action: "pin"; productSlug: string | null }
        | {
            action: "update";
            title?: string;
            description?: string | null;
            coverImageUrl?: string | null;
          }
        | { action: "cancel" },
    ) =>
      apiFetch<{ id: string; status?: LiveBroadcastStatus; pinnedProductSlug?: string | null }>(
        `/api/v1/live/${id}`,
        { method: "PATCH", body: input },
      ),

    /** Public best-effort viewer presence ping. */
    heartbeat: (id: string) =>
      apiFetch<{ live: boolean; status?: LiveBroadcastStatus }>(
        `/api/v1/live/${id}/heartbeat`,
        { method: "POST", anonymous: true },
      ),

    listComments: (id: string, since?: string) =>
      apiFetch<{
        comments: Array<{
          id: string;
          displayName: string;
          body: string;
          isSystem: boolean;
          createdAt: string;
        }>;
      }>(`/api/v1/live/${id}/comments`, {
        anonymous: true,
        query: since ? { since } : undefined,
      }),

    postComment: (
      id: string,
      input: { body: string; displayName: string },
    ) =>
      apiFetch<{
        comment: {
          id: string;
          displayName: string;
          body: string;
          isSystem: boolean;
          createdAt: string;
        };
      }>(`/api/v1/live/${id}/comments`, {
        method: "POST",
        body: input,
        anonymous: true,
      }),
  },

  /**
   * V2.0 Group Buy. Single shared client for buyer-side rails + the
   * dedicated detail/join screen + the seller create form.
   */
  groupBuy: {
    /** Public list of active + recently-filled campaigns on a shop. */
    forShop: (slug: string) =>
      apiFetch<{ groupBuys: GroupBuySummary[] }>(
        `/api/v1/shops/${slug}/group-buys`,
        { anonymous: true },
      ),

    /** Public detail — includes currentPriceSatang + nextTier hint. */
    get: (id: string) =>
      apiFetch<{ groupBuy: GroupBuySummary }>(
        `/api/v1/group-buys/${id}`,
        { anonymous: true },
      ),

    /**
     * Owner-only schedule. Tiers should be sorted ascending by minQty +
     * descending by priceSatang — server validates this.
     */
    create: (
      shopSlug: string,
      input: {
        productSlug: string;
        title: string;
        description?: string;
        minQty: number;
        maxQty?: number | null;
        deadline: string; // ISO datetime
        tiers?: Array<{ minQty: number; priceSatang: number }>;
      },
    ) =>
      apiFetch<{
        groupBuy: {
          id: string;
          title: string;
          minQty: number;
          maxQty: number | null;
          tiers: Array<{ minQty: number; priceSatang: number }>;
          deadline: string;
          status: GroupBuyStatus;
          createdAt: string;
        };
      }>(`/api/v1/shops/${shopSlug}/group-buys`, {
        method: "POST",
        body: input,
      }),

    /** Public join — same payload as a normal order minus shopSlug. */
    join: (
      id: string,
      input: {
        qty: number;
        customerName: string;
        customerPhone?: string;
        customerEmail?: string;
        customerAddress?: string;
        notes?: string;
        shippingSatang?: number;
        referrerUserId?: string;
        referrerCode?: string;
        useEscrow?: boolean;
      },
    ) =>
      apiFetch<{
        orderToken: string;
        currentQty: number;
        filled: boolean;
        qr: { dataUrl: string; payload: string; amount: number } | null;
      }>(`/api/v1/group-buys/${id}/join`, {
        method: "POST",
        body: input,
        anonymous: true,
      }),

    /** Owner-only cancel (only valid for ACTIVE campaigns). */
    cancel: (id: string) =>
      apiFetch<{ id: string; status: GroupBuyStatus }>(
        `/api/v1/group-buys/${id}`,
        { method: "DELETE" },
      ),
  },

  /**
   * V1.0: composite home rails (featured shops + flash-sale coupons). Single
   * round-trip so the home screen doesn't fan out three rails-worth of fetches.
   */
  discovery: {
    rails: () =>
      apiFetch<{
        featured: ShopSummary[];
        flashSale: Array<{
          id: string;
          code: string;
          kind: "percent" | "fixed";
          /** Percent (1..100) for PERCENT, satang amount for FIXED. */
          value: number;
          minOrderSatang: number | null;
          expiresAt: string;
          shop: {
            id: string;
            slug: string;
            name: string;
            logoText: string | null;
            logoUrl: string | null;
            themeColor: string;
            kycStatus: KycStatus;
          };
        }>;
      }>("/api/v1/discovery-rails", { anonymous: true }),
  },

  feed: {
    /// V1: shops discovery feed. Personalized when authenticated, popular otherwise.
    list: (params: {
      cursor?: string;
      category?: string;
      tab?: "for-you" | "new" | "following";
      /** V1.5: restrict to KYC-verified shops only. */
      verified?: boolean;
    } = {}) =>
      apiFetch<{
        shops: ShopSummary[];
        nextCursor: string | null;
      }>("/api/v1/feed", { query: params, anonymous: !params.tab || params.tab !== "following" }),
  },

  /**
   * V1.1: product-first feed for the Shopee-style mobile home. Returns a
   * paginated mix of products from every ACTIVE non-suspended shop. We use
   * this on the home tab — the shop feed (`api.feed.list`) lives on the
   * shops/discovery tab.
   */
  productsFeed: {
    list: (
      params: {
        cursor?: string;
        category?: string;
        sort?: "relevance" | "sold" | "newest" | "price-asc" | "price-desc";
        /** V1.5: restrict feed to KYC-verified shops only. */
        verified?: boolean;
        /** V2.1: restrict feed to PRE_OWNED listings only. */
        condition?: "NEW" | "PRE_OWNED";
      } = {},
    ) =>
      apiFetch<{
        products: Array<{
          id: string;
          slug: string;
          shopSlug: string;
          shopName: string;
          shopLogoText: string | null;
          shopLogoUrl: string | null;
          shopThemeColor: string;
          shopKycStatus: KycStatus;
          shopTrustScore: number;
          shopRating: number;
          name: string;
          priceSatang: number;
          compareAtSatang: number | null;
          imageUrl: string | null;
          badge: "HOT" | "NEW" | "SALE" | null;
          sold: number;
          category: string | null;
          condition: "NEW" | "PRE_OWNED";
          type: "PHYSICAL" | "DIGITAL";
        }>;
        nextCursor: string | null;
      }>("/api/v1/products-feed", { query: params, anonymous: true }),
  },

  search: (params: {
    q: string;
    category?: string;
    sort?: "relevance" | "sold" | "price-asc" | "price-desc" | "newest";
    cursor?: string;
    /** Restrict to KYC-verified shops only (V1.5+ filter). */
    verified?: boolean;
    /** Min product price in satang (inclusive). */
    minPriceSatang?: number;
    /** Max product price in satang (inclusive). */
    maxPriceSatang?: number;
    /** Minimum shop rating 1-5. */
    minRating?: number;
  }) =>
    apiFetch<{
      shops: ShopSummary[];
      products: Array<{
        slug: string;
        shopSlug: string;
        shopName: string;
        /** Shop's KYC status — used to render the inline VerifiedBadge. */
        shopKycStatus: KycStatus;
        /** Shop's trust score 0–100 — surfaced as a pill on hover/tap. */
        shopTrustScore: number;
        name: string;
        priceSatang: number;
        imageUrl: string | null;
      }>;
      nextCursor: string | null;
    }>("/api/v1/search", { query: params, anonymous: true }),

  categories: () =>
    apiFetch<{
      categories: Array<{ key: string; shopCount: number }>;
    }>("/api/v1/categories", { anonymous: true }),

  /**
   * Lookup Thai address candidates by 5-digit postcode — wraps the web's
   * `/api/v1/thai-address` endpoint (which itself uses the `thai-data` npm
   * package). Same shape on web + mobile so the UX is consistent.
   */
  thaiAddress: (postcode: string) =>
    apiFetch<{
      postcode: string;
      options: Array<{
        key: string;
        postcode: string;
        subdistrict: string;
        district: string;
        province: string;
      }>;
    }>("/api/v1/thai-address", { query: { postcode }, anonymous: true }),

  shops: {
    follow: (slug: string) =>
      apiFetch<{ following: true }>(`/api/v1/shops/${slug}/follow`, { method: "POST" }),
    unfollow: (slug: string) =>
      apiFetch<{ following: false }>(`/api/v1/shops/${slug}/follow`, { method: "DELETE" }),
    favorite: (slug: string) =>
      apiFetch<{ favorited: true }>(`/api/v1/shops/${slug}/favorite`, { method: "POST" }),
    unfavorite: (slug: string) =>
      apiFetch<{ favorited: false }>(`/api/v1/shops/${slug}/favorite`, { method: "DELETE" }),

    /**
     * Validate a coupon code against a subtotal. Server returns `discountSatang`
     * which the cart then subtracts. Server re-validates again on order create
     * — we never trust the client's calculated discount.
     */
    redeemCoupon: (
      slug: string,
      input: { code: string; subtotalSatang: number },
    ) =>
      apiFetch<{
        couponId: string;
        code: string;
        type: "PERCENT" | "FIXED";
        discountSatang: number;
      }>(`/api/v1/shops/${slug}/coupons/redeem`, {
        method: "POST",
        body: input,
        anonymous: true,
      }),

    /**
     * Read the buyer's loyalty wallet for a specific shop. Phone is the
     * cross-shop identifier (per CustomerLoyalty schema). Returns points,
     * total spent, plus the shop's earn/burn config.
     */
    loyalty: (slug: string, phone: string) =>
      apiFetch<{
        points: number;
        totalSpentSatang: number;
        config: {
          bahtPerPoint: number;
          bahtValuePerPoint: number;
        };
      }>(`/api/v1/shops/${slug}/loyalty/${phone}`, { anonymous: true }),

    /**
     * V1.5: list reviews for a shop. Public — used by mobile shop page to
     * render verified-pill reviews under the catalog. Each review carries
     * `verified: true` if the underlying order had `slipVerifiedAt` (which
     * V1.5 reviews enforce on POST).
     */
    reviews: (slug: string) =>
      apiFetch<{
        reviews: Array<{
          id: string;
          rating: number;
          comment: string | null;
          customerName: string;
          reply: string | null;
          repliedAt: string | null;
          createdAt: string;
          product: { slug: string; name: string } | null;
          verified: boolean;
        }>;
        summary: { averageRating: number; totalReviews: number };
      }>(`/api/v1/shops/${slug}/reviews`, { anonymous: true }),

    /**
     * V1.5: submit a review tied to a delivered order. Server requires:
     *   - orderToken belongs to this shop
     *   - order in SHIPPING / DELIVERED
     *   - order.slipVerifiedAt is non-null (slip-verified reviews only)
     *   - one review per order
     */
    submitReview: (
      slug: string,
      input: {
        orderToken: string;
        rating: number;
        comment?: string;
        productSlug?: string;
      },
    ) =>
      apiFetch<{
        review: {
          id: string;
          rating: number;
          comment: string | null;
          createdAt: string;
        };
      }>(`/api/v1/shops/${slug}/reviews`, {
        method: "POST",
        body: input,
        anonymous: true,
      }),

    /**
     * V1.5 KYC submission for a shop the current user owns. Read-only GET
     * also surfaces the current submission so the wizard can show prefilled
     * status banners (PENDING / REJECTED → reason).
     */
    kycStatus: (slug: string) =>
      apiFetch<{
        id: string;
        kycStatus: "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
        kycVerifiedAt: string | null;
        kycRejectedReason: string | null;
        kycDocType: "NID" | "PASSPORT" | "COMPANY_REG" | null;
        kycLegalName: string | null;
        kycIdLast4: string | null;
        kycSubmittedAt: string | null;
        kycReviewedAt: string | null;
        kycDocFrontUrl: string | null;
        kycDocBackUrl: string | null;
        kycSelfieUrl: string | null;
      }>(`/api/v1/shops/${slug}/kyc`),

    submitKyc: (
      slug: string,
      input: {
        docType: "NID" | "PASSPORT" | "COMPANY_REG";
        legalName: string;
        idLast4: string;
        docFrontUrl: string;
        docBackUrl?: string;
        selfieUrl: string;
      },
    ) =>
      apiFetch<{
        id: string;
        kycStatus: "PENDING";
        kycSubmittedAt: string;
      }>(`/api/v1/shops/${slug}/kyc`, { method: "POST", body: input }),

    /**
     * Owner-only edit of shop info — banner upload, logo, theme color,
     * name, description, contact. Server enforces shop ownership.
     */
    update: (
      slug: string,
      input: {
        name?: string;
        description?: string | null;
        themeColor?: string;
        logoText?: string | null;
        logoUrl?: string | null;
        /** Up to 3 banner image URLs. Empty array = fall back to themeColor. */
        bannerUrls?: string[];
        announcement?: string | null;
        contact?: {
          phone?: string | null;
          line?: string | null;
          facebook?: string | null;
        };
      },
    ) =>
      apiFetch<{ shop: { id: string; slug: string } }>(
        `/api/v1/shops/${slug}`,
        { method: "PATCH", body: input },
      ),

    /**
     * Seller create-product (mobile). Mirrors the web product-form payload —
     * server slugifies the name when `slug` is omitted. Image uploads are a
     * two-step flow (upload first → pass the resulting URLs in `imageUrls`).
     */
    createProduct: (
      slug: string,
      input: {
        name: string;
        slug?: string;
        description?: string;
        priceBaht: number;
        compareAtBaht?: number;
        imageUrls?: string[];
        badge?: "HOT" | "NEW" | "SALE" | null;
        type?: "PHYSICAL" | "DIGITAL";
        category?: string | null;
        condition?: "NEW" | "PRE_OWNED";
        stock?: number;
      },
    ) =>
      apiFetch<{
        product: {
          id: string;
          slug: string;
          name: string;
          priceSatang: number;
          imageUrls: string[];
          status: string;
        };
      }>(`/api/v1/shops/${slug}/products`, {
        method: "POST",
        body: input,
      }),

    /// Seller edit/PATCH product fields. Pass only the keys you want to
    /// change — server merges with existing row.
    updateProduct: (
      shopSlug: string,
      productSlug: string,
      input: {
        name?: string;
        description?: string | null;
        priceBaht?: number;
        compareAtBaht?: number | null;
        imageUrls?: string[];
        badge?: "HOT" | "NEW" | "SALE" | null;
        type?: "PHYSICAL" | "DIGITAL";
        category?: string | null;
        condition?: "NEW" | "PRE_OWNED";
        stock?: number | null;
        status?: "ACTIVE" | "HIDDEN" | "SOLD_OUT";
      },
    ) =>
      apiFetch<{
        product: { id: string; slug: string; name: string };
      }>(`/api/v1/shops/${shopSlug}/products/${productSlug}`, {
        method: "PATCH",
        body: input,
      }),

    /// Seller delete product. Returns { deleted: true } on success.
    deleteProduct: (shopSlug: string, productSlug: string) =>
      apiFetch<{ deleted: true }>(
        `/api/v1/shops/${shopSlug}/products/${productSlug}`,
        { method: "DELETE" },
      ),

    /** Seller dashboard summary — counts + revenue rollups. */
    stats: (slug: string) =>
      apiFetch<{
        pendingOrderCount: number;
        paidOrderCount: number;
        shippingOrderCount: number;
        todaySalesSatang: number;
        last7dSalesSatang: number;
        last30dSalesSatang: number;
        unreadConversationCount: number;
      }>(`/api/v1/shops/${slug}/stats`),

    /**
     * Business+ chat inbox. Returns conversations sorted by `lastMessageAt`
     * desc (newest activity first). Empty `lineWebhookEnabled=false` flag is
     * the signal to mobile that this shop hasn't wired up LINE OA yet —
     * surface the upgrade CTA in the UI rather than showing a 404.
     */
    conversations: (slug: string) =>
      apiFetch<{
        conversations: Array<{
          id: string;
          shopId: string;
          customerLineUserId: string;
          customerName: string | null;
          customerPictureUrl: string | null;
          lastMessageText: string | null;
          lastMessageAt: string;
          unreadCount: number;
          createdAt: string;
        }>;
        lineWebhookEnabled: boolean;
      }>(`/api/v1/shops/${slug}/conversations`),

    /**
     * Single conversation with messages. Also marks the conversation as read
     * (server side) when fetched. Poll every few seconds for "real-time"-ish
     * feel until we ship Pusher.
     */
    conversation: (slug: string, id: string) =>
      apiFetch<{
        conversation: {
          id: string;
          shopId: string;
          customerLineUserId: string;
          customerName: string | null;
          customerPictureUrl: string | null;
          lastMessageText: string | null;
          lastMessageAt: string;
          unreadCount: number;
          createdAt: string;
          messages: Array<{
            id: string;
            conversationId: string;
            direction: "INBOUND" | "OUTBOUND";
            text: string | null;
            imageUrl: string | null;
            createdAt: string;
          }>;
        };
      }>(`/api/v1/shops/${slug}/conversations/${id}`),

    /** Send a reply via LINE Push API (seller → buyer). */
    sendMessage: (slug: string, id: string, text: string) =>
      apiFetch<{
        message: {
          id: string;
          conversationId: string;
          direction: "OUTBOUND";
          text: string;
          createdAt: string;
        };
      }>(`/api/v1/shops/${slug}/conversations/${id}`, {
        method: "POST",
        body: { text },
      }),

    /** Seller orders list — filterable by status. */
    orders: (
      slug: string,
      params: {
        status?: "PENDING" | "PAID" | "SHIPPING" | "DELIVERED" | "CANCELLED";
        cursor?: string;
      } = {},
    ) =>
      apiFetch<{
        orders: Array<{
          id: string;
          publicToken: string;
          status: string;
          totalSatang: number;
          subtotalSatang: number;
          shippingSatang: number;
          customerName: string;
          customerPhone: string | null;
          customerAddress: string | null;
          slipImageUrl: string | null;
          slipVerifiedAt: string | null;
          trackingNumber: string | null;
          createdAt: string;
          items: Array<{
            productId?: string;
            productSlug?: string;
            name: string;
            qty: number;
            priceSatang: number;
            image?: string | null;
          }>;
        }>;
        nextCursor: string | null;
      }>(`/api/v1/shops/${slug}/orders`, { query: params }),
  },

  /**
   * Direct image upload — wraps `/api/v1/upload` (Vercel Blob backed).
   * Mobile uses the JSON path with base64-encoded data because RN's
   * `FormData` + `File` shim is fragile across Android device fleets.
   */
  upload: {
    fromBase64: (input: {
      filename: string;
      contentType:
        | "image/jpeg"
        | "image/png"
        | "image/webp"
        | "video/mp4"
        | "video/quicktime";
      dataBase64: string;
    }) =>
      apiFetch<{ url: string; pathname: string; size: number }>(
        "/api/v1/upload",
        { method: "POST", body: input },
      ),
  },
};
