# SalePage Mobile Roadmap

> Native mobile app (iOS + Android) ที่เป็น **marketplace + companion** ของ `salepage.in.th`
> ความแตกต่างจาก Shopee: ทุกร้านรับเงินตรงผ่าน PromptPay → AI verify slip → 0% commission per order

โครงสร้างเอกสาร: vision → tech decisions → phase V0.5–V3.0 (พร้อม checklist) → backend changes → trust layer → GTM → risks

---

## 🎯 Vision

> **"Marketplace ที่ไม่กินเงินคุณ — เจ้าของร้านได้เงินตรง ลูกค้าได้ของถูกกว่า"**

**Differentiation pillars (4 หลัก):**

1. **Speed** — จ่ายเสร็จ verify ภายใน 5 วินาที ร้านได้เงินทันที
2. **Cost** — 0% commission per order (vs Shopee 2-5%) เก็บค่าบริการรายเดือน
3. **Direct relationship** — ลูกค้าเป็นของร้าน (ได้เบอร์ + LINE userId) ไม่ใช่ของแพลตฟอร์ม
4. **Thai-first** — PromptPay native, Kanit/Thai UI, Thai courier integration

---

## 🛠 Tech Stack — Final Decisions

### Mobile

| Layer | Choice | เหตุผล |
|---|---|---|
| Runtime | React Native 0.79 + Expo SDK 53 | share TS code/types กับ Next.js, fast iteration via EAS |
| Routing | Expo Router (file-based) | mirror โครงของ `src/app/[locale]/` |
| Styling | NativeWind (Tailwind for RN) | ใช้สี/spacing ตัวเดียวกับเว็บ (`--color-brand-*`) |
| State (server) | TanStack Query v5 | cache + sync ทุก endpoint `/api/v1/*` |
| State (client) | Zustand + MMKV | cart, UI state, persist เร็ว |
| Forms | React Hook Form + Zod | re-use schemas จาก `src/lib/` |
| Auth | LINE Login native SDK + JWT | NextAuth database session ไม่เหมาะ native |
| Push | Expo Notifications + APNs/FCM | ลด overhead jonqliu native config |
| Image | expo-image | better caching, blurhash |
| Camera | expo-camera + expo-barcode-scanner | สลิป + QR |
| Real-time | Pusher Channels หรือ Supabase Realtime | chat (V1+) |

### Backend additions (Next.js side)

ดูหัวข้อ "Backend Schema Changes" + "API Endpoints to Add" ด้านล่าง

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  SalePage Mobile App (RN + Expo)                         │
│                                                           │
│  Buyer Mode (default)   ←→   Seller Mode (toggle)        │
│                                                           │
│  Discovery / Cart / Slip  /  Dashboard / Orders / Chat   │
└──────────────┬───────────────────────────┬───────────────┘
               │ HTTPS                     │ HTTPS
               ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│  salepage.in.th  (Next.js 16 on Vercel)                  │
│  ├─ /api/v1/auth/line-mobile   (NEW: JWT for native)     │
│  ├─ /api/v1/feed               (NEW: discovery)          │
│  ├─ /api/v1/search             (NEW: cross-shop)         │
│  ├─ /api/v1/me/*               (NEW: cross-shop user)    │
│  └─ existing /api/v1/{shops,orders,slip,billing,line}    │
└──────────────────────────────┬──────────────────────────┘
                               ▼
                      Postgres (Neon SG) via Prisma 7
                      + Stripe + SlipOK + LINE Messaging
```

**One app, dual mode** — toggle ตาม `User.role` หรือว่ามี shop ไหม
ระยะ 2 ค่อยแยก app ถ้า seller side ใหญ่พอ

---

## 📅 Phases & Checklists

### Legend
- [ ] = pending
- [~] = in progress
- [x] = done
- 🔥 = critical path
- 💎 = differentiator (ไม่มี = แข่งไม่ได้)

---

### V0.5 — Native Companion (Month 1-2)

**Goal**: เปิดได้แค่ตามลิงก์/QR ของร้าน — ทดสอบ checkout flow เต็ม
**Success metric**: shop owners เดิม > 30 ราย ใช้แอปแนะนำลูกค้า, slip verify success rate ≥ 95%

#### Foundation
- [x] เขียน `ROADMAP.md` (this file)
- [x] Scaffold `mobile/` (Expo + Expo Router + TS + NativeWind) 🔥
- [x] Setup `mobile/eas.json` (preview/production channels)
- [x] Shared types (`mobile/src/types/api.ts`)
- [x] API client `mobile/src/lib/api.ts` — typed fetch ผูก `/api/v1/*`
- [x] เพิ่ม `/api/v1/auth/line-mobile` route 🔥
- [x] JWT signing/verifying lib (`src/lib/mobile-jwt.ts`)
- [x] `src/lib/api-auth.ts` — Bearer + cookie unified resolver
- [ ] App icon + splash screen (brand rose + LogoMark) — _user uploads_

#### Auth
- [x] LINE Login native via `expo-auth-session` (PKCE) 🔥
- [x] Token storage ใน `expo-secure-store`
- [x] `useLineSignIn()` hook (orchestrates LINE → JWT → push register → nav)
- [x] `POST /api/v1/auth/refresh` — sliding 7-day JWT
- [x] Email magic link deep link `salepage://auth?token=...` — wired in `_layout.tsx` via Expo Linking + setAuthToken

#### Shop & Product Browsing
- [x] Shop view screen (ดึงจาก `GET /api/v1/shops/:slug`) 🔥
- [x] Product detail screen
- [x] Add to cart (Zustand store)
- [x] Image gallery (swipe + paging dots + tap-to-zoom modal w/ pinch + double-tap + swipe-to-close) via `react-native-awesome-gallery`
- [x] Share product/shop → native Share API (iOS + Android), uses `webBaseUrl` so links resolve to public domain even in dev

#### Checkout & Payment 💎
- [x] Cart screen (single-shop, multi-item)
- [x] Address form (basic) + create order
- [x] PromptPay QR display screen 🔥 (uses `qr.dataUrl` from GET /orders/:token)
- [x] Address autocomplete via `thai-data` — `AddressPicker` component (postcode → subdistrict picker)
- [x] Coupon input — `CouponLoyaltyPanel` (single-shop only); server re-validates
- [x] Loyalty points slider with ±10 + half + max buttons (single-shop only)
- [ ] Open mobile banking app intent
- [x] Countdown timer 15 นาที — in checkout screen (visual only; cron auto-cancels server-side)

#### Slip Verification 💎🔥
- [x] Camera screen for slip capture (`expo-camera`)
- [x] QR scanner mode (`barcodeScanningResult`) 🔥
- [x] Image picker fallback
- [x] Upload to `POST /api/v1/orders/:token/slip` — switched from broken multipart to base64 JSON to match server contract
- [x] Show verify result (success / mismatch / error)
- [x] Image compression before upload — `compressForSlipUpload()` via `expo-image-manipulator`, longest-edge 1600px + JPEG q=0.82 (~5–10 MB → ~200 KB)
- [ ] Auto-extract slip from iOS Photos
- [ ] Android SmsRetriever — banking notification auto-pull (stretch)

#### Order Tracking
- [x] Tracking screen with timeline 🔥
- [x] Auto-refresh every 15s + manual refresh
- [x] Tracking number → external link
- [ ] In-app webview courier tracking (V1)
- [x] Cancel order action — `POST /api/v1/orders/:token/cancel` + checkout screen link (PENDING-only)

#### Push Notifications 🔥
- [x] `mobile/src/lib/push.ts` — register/unregister, foreground handler
- [x] Schema: `User.expoPushToken`
- [x] `POST/DELETE /api/v1/me/push-token`
- [x] `src/lib/push-notify.ts` — Expo Push API wrapper + dead-token cleanup
- [x] `resolveCustomerUserId()` helper — maps Order → User.id via LINE Account or email
- [x] **Wired**: `notifyOrderPaid` in slip verify route (`/orders/:token/slip`) + status PATCH route
- [x] **Wired**: `notifyOrderShipping` in shipment route (markShipping) + status PATCH route
- [x] **Wired**: `notifyOrderDelivered` in status PATCH route
- [x] Deep link from notification → `/o/<token>`

#### Deep Link & Universal Link
- [x] iOS Universal Link config (AASA at `public/.well-known/`)
- [x] Android App Link config (assetlinks.json)
- [x] Custom scheme: `salepage://`
- [x] `next.config.ts` Content-Type headers for AASA
- [ ] Apple Team ID + Android SHA256 in AASA/assetlinks (placeholders) — _user fills in after EAS build_
- [ ] LINE LIFF → app fallback (open app if installed, else web)

#### QA & Release
- [ ] EAS Build internal testing (TestFlight + Play Internal)
- [ ] Sentry RN integration (re-use Sentry org)
- [ ] Privacy policy update for mobile (camera, push, location)
- [ ] App Store + Play Store listing (Thai + English)

---

### V1.0 — Discovery Marketplace (Month 3-4)

**Goal**: หน้าแอปเปิดมาเหมือน Shopee — แต่ pitch ขายว่า "ของถูกกว่าเพราะร้าน 0% fee"
**Success metric**: DAU > 5,000, conversion view→order ≥ 3%, Verified shops ≥ 200

#### Discovery Feed 💎
- [x] Endpoint: `GET /api/v1/feed?tab=for-you|new|following&category=` 🔥
- [x] Home tabs: For You / New / Following
- [x] V1.0 ranking proxy: featured > totalSold > rating > recency
- [x] Categories rail in feed
- [x] Featured shops carousel — `GET /api/v1/discovery-rails` + `<DiscoveryRails />` mobile component
- [x] Flash Sale rail — active coupons in next 72h, with countdown timer that ticks every 30s
- [x] Pull-to-refresh + infinite scroll — home feed converted to `useInfiniteQuery` with 600px-buffer scroll trigger
- [ ] "For You" ranking: location + view history + category affinity (uses `ProductView`) — _V1.5_

#### Search 🔥
- [x] `GET /api/v1/search?q=&category=&sort=&cursor=`
- [x] Mobile search screen with debounced input + shop chips + product grid
- [x] Sort modes: relevance / sold / price-asc / price-desc / newest
- [ ] Postgres full-text indexes (currently uses ILIKE — fine to ~50k shops)
- [x] Filter sheet: price range / rating / verified / sort — modal sheet with active filter count badge
- [x] Recent searches (AsyncStorage, capped 8 entries) + clear-all action

#### Categories
- [x] `GET /api/v1/categories` — list with active shop counts
- [x] Category chips in discover feed
- [x] Category landing page — `/c/[slug]` with infinite scroll + emoji header

#### Cross-shop Cart 💎
- [x] Cart store keyed by shopSlug — multi-shop bag with per-shop subtotal
- [x] `POST /api/v1/orders/multi` — atomic multi-order creation in transaction
- [x] Cart screen renders shop-by-shop with per-shop "remove shop" button
- [x] `/checkout/multi?tokens=t1,t2,...` — overview screen with per-order status + tap-to-settle
- [x] Slip ต่อร้าน (per-order, reuses existing `/checkout/[token]` flow)
- [ ] Per-shop coupons + loyalty in multi-checkout (deferred — V1.1)
- [x] Per-shop notes input in cart UI — keyed by `shopSlug`, threaded into both single + multi-order POSTs

#### User Account
- [x] Profile screen (`/me`) + LINE picture + counts
- [x] Order history cross-shop (`GET /api/v1/me/orders`) 🔥
- [x] Following shops (`POST /api/v1/shops/:slug/follow` + DELETE)
- [x] Wishlist / Favorites (`POST /api/v1/shops/:slug/favorite` + DELETE + `GET /api/v1/me/favorites`)
- [x] Logout flow (clear push + JWT)
- [x] Notification preferences (per-shop notifyNew/notifyLive/notifySale) — `/me/notifications` screen with optimistic switches
- [x] Address book screen (`/me/addresses`) — derived from past orders, share-to-copy

#### Loyalty Wallet 💎
- [x] `GET /api/v1/me/wallet` — aggregates `CustomerLoyalty` rows by phone across every shop the user has bought from
- [x] `/me/wallet` screen with brand-toned hero card + per-shop rows + tap-to-open shop
- [ ] Available coupons รายร้าน (V1.6.1 — list `Coupon` rows applicable to wallet phone)
- [ ] Activity history (V1.6.1 — needs `LoyaltyLedger` model)

#### In-app Chat (Business+ tier shops only)
- [x] Chat list (`/seller/chat`) — sorted by `lastMessageAt` desc + unread badge 🔥
- [x] Chat thread (`/seller/chat/[id]`) — text reply via LINE Push API + 5s polling
- [x] Mobile API conversations/conversation/sendMessage methods (resolveSession-based)
- [x] LINE OA upgrade CTA when `lineWebhookEnabled=false` (links to web settings)
- [ ] Real-time via Pusher/Ably (replace polling — V1.6)
- [ ] Typing indicator (V1.6)
- [ ] Image messages from mobile (text-only for now)
- [ ] Fallback: ถ้าร้านไม่ Business+ → deep link LINE OA native

#### Verified Seller Layer 💎🔥
- [x] `Shop.kycStatus` enum (NONE/PENDING/VERIFIED/REJECTED/EXPIRED) + `Shop.trustScore` Int + `Shop.kycVerifiedAt` + indexes
- [x] `src/lib/trust-score.ts` — pure `computeTrustScore()` + DB-aware `recomputeTrustScore(shopId)`
- [x] `VerifiedBadge` component (compact + label variants) — used inline next to shop names
- [x] `TrustMeter` component (full bar + pill variants, 4-tier color system)
- [x] `RiskWarning` banner — surfaces on shop screen for unverified shops with score < 50
- [x] `kycStatus` + `trustScore` exposed on `/api/v1/feed`, `/api/v1/search`, `/api/v1/shops/[slug]`
- [x] `?verified=true` filter on `/api/v1/feed` and `/api/v1/search` — toggle UI in mobile
- [x] Demo shops surface as VERIFIED + trustScore=80 for marketing screenshots
- [x] Admin UI: `/admin/kyc` page with status filters + inline approve/reject + audit log
- [x] `POST /api/v1/shops/:slug/kyc` + mobile `/me/kyc` wizard (doc type / legal name / id last4 / front+back+selfie via Vercel Blob)
- [x] `PATCH /api/v1/admin/kyc/:id` — approve/reject with reason + push notify owner + recompute trust
- [x] Cron: `0 18 1 * *` monthly `/api/v1/cron/trust-score-sweep` — recomputes every active shop
- [x] Cron: `*/5 * * * *` `/api/v1/cron/expire-pending-orders` — auto-cancels stale PENDING orders
- [x] "Verified Only" toggle UI in feed header + filter pill + count badge
- [x] KYC entry point in `/me` profile screen + sidebar link `Admin → KYC review`

#### Seller Mobile Dashboard
- [x] Mode toggle (Buyer ↔ Seller) — amber banner in `/me`, only visible to shop owners
- [x] Persisted seller mode via Zustand (`useSellerMode`) + active shop slug
- [x] `/seller` home: shop picker, Trust Meter, urgency-coded stat cards, action grid
- [x] `GET /api/v1/shops/:slug/stats` — pending/paid/shipping counts + today/7d/30d revenue
- [x] `GET /api/v1/shops/:slug/orders?status=` — paginated, status-filtered
- [x] `/seller/orders` — tabbed inbox with one-tap approve/reject + mark-shipping 🔥
- [x] `/seller/products` — read-only list, deep link to web for edit/create
- [x] `/seller/chat` + `/seller/chat/[id]` (Business+ only)
- [ ] Analytics screen (full charts — V1.6)
- [ ] Camera → upload product flow on mobile (Vercel Blob + AI describe)
- [x] Push notification เมื่อ slip incoming — `notifyShopNewOrder` fires in slip-verify route when PENDING→PAID, deep-links to seller dashboard

---

### V1.5 — Trust Layer (Month 5-6)

**Goal**: ลด churn ลูกค้ากลัวโดนโกง → unlock electronics + higher AOV verticals
**Success metric**: Dispute rate < 0.5%, refund rate < 1%, AOV +30%

#### KYC Integration 💎🔥
- [ ] เลือก provider: NDID หรือ Stripe Identity
- [ ] In-app KYC flow (ID + selfie + bank account match)
- [ ] Update `Shop.kycStatus` workflow
- [ ] Admin review queue (`/admin/kyc`)

#### Protected Pay (Optional Escrow) 💎🔥
- [ ] เลือก provider: 2C2P escrow / Beam / KBank Open API
- [ ] Schema: `EscrowHold` table (orderId, amount, releaseAt, status)
- [ ] Toggle ที่ checkout: Direct Pay (0%) vs Protected Pay (1.5%)
- [ ] Auto-release เมื่อ DELIVERED + 3 วัน หรือ buyer confirm
- [ ] Manual release endpoint (admin)
- [ ] ร้าน Verified สามารถ require Direct Pay only

#### Dispute Flow
- [x] Schema: `Dispute` model + `DisputeReason` + `DisputeStatus` enums + back-relation on Order
- [x] `POST /api/v1/orders/:token/disputes` — token-scoped, public; enforces 7-day post-DELIVERED window, blocks PENDING/CANCELLED, blocks duplicate OPEN disputes
- [x] `GET /api/v1/orders/:token/disputes` — surface existing disputes on tracking page
- [x] Open dispute screen `/o/[token]/dispute` — 6 reason chips, freeform description (10–2000 chars), up to 5 evidence images via Vercel Blob
- [x] Admin review queue (`/admin/disputes`) — status filter pills (ACTIVE/OPEN/AWAITING_*/RESOLVED_*), evidence preview, stale 72h indicator
- [x] `PATCH /api/v1/admin/disputes/:id` — 5 actions: `resolve_refund`, `resolve_replace`, `resolve_no_action`, `request_shop_response`, `request_buyer_response`
- [x] Auto-resolve cron `/api/v1/cron/auto-resolve-disputes` — every 30min; flips AWAITING_SHOP_RESPONSE → RESOLVED_REFUND after 72h, also CANCELs the order
- [x] Trust Score deduction on lose — `recomputeTrustScore` fires on every refund/replace resolution + auto-resolve
- [x] Push notifications — buyer + shop both notified on every state transition (LINE→User resolution via `resolveCustomerUserId`)
- [x] Public dispute stats on shop page — `/api/v1/shops/:slug` returns 90-day `disputeStats { count, deliveredCount, ratePct }`; mobile shop screen renders amber pill when count > 0

#### Affiliate / Sharing 💎
- [x] `Order.referrerUserId` + `Order.referrerCode` schema fields (V1.5)
- [x] `?ref=<userId>` query param accepted by `POST /api/v1/orders` — best-effort attribution
- [x] `mobile/src/lib/affiliate.ts` — 30-day TTL referrer store in AsyncStorage
- [x] Deep link handler captures `?ref=` on ANY incoming URL (shop/product/auth/etc.)
- [x] Cart threads referrer into single-shop `orders.create`
- [x] `shareShop()` / `shareProduct()` accept optional `referrerUserId` to tag outgoing links
- [x] Share to LINE/TikTok/IG native sheet (works via system Share API + webBaseUrl)
- [x] Multi-order route attribution — `POST /api/v1/orders/multi` accepts referrer + writes to every child Order in the transaction
- [x] Affiliate dashboard `/me/earnings` — pending/paid/cancelled buckets + lifetime rollup + share-my-link CTA
- [x] `GET /api/v1/me/earnings` — commission rollup with payable balance, pending/paid/cancelled buckets, payouts history
- [x] **AffiliatePayout** schema + enum + lifecycle (REQUESTED → APPROVED → PAID, or REJECTED/CANCELLED)
- [x] `POST /api/v1/me/payouts` — user requests cashout, tx-locked balance check, 50฿ minimum
- [x] `PATCH /api/v1/admin/payouts/:id` — admin approve / mark_paid (with txn ref) / reject (with reason)
- [x] `/admin/payouts` admin queue with status filters + outstanding total + push to user on every transition
- [x] Mobile `/me/earnings` payout sheet — amount + PromptPay input, balance recompute, payouts history pills
- [x] Per-shop affiliate rate override (`Shop.affiliateRatePct`, capped 0–10%, default 2%)
- [x] `src/lib/affiliate.ts` — shared `commissionFor()` + `computeAffiliateBalance()` honoring per-shop rates
- [ ] Cron auto-payout to PromptPay (V1.6.2 — manual admin transfer for now, ref logged in audit)

#### Bluetooth Label Printer
- [ ] Integrate iMin / Phomemo / generic ESC/POS printers
- [ ] Print waybill จากหน้า order ใน seller mode
- [ ] Save printer config local

#### Slip-verified Reviews Only
- [x] Block review POST ถ้าไม่มี `orderId` หรือ `slipVerifiedAt = null` (returns `slip_not_verified` error)
- [x] `GET /api/v1/shops/:slug/reviews` returns `verified` boolean per review (derived from `order.slipVerifiedAt`)
- [x] Verified badge rendered on web `/s/:slug` — emerald "✓ verified" pill next to reviewer name
- [x] Mobile reviews surfaced on `/s/[slug]` via `<ReviewsList />` with verified pill
- [x] Mobile post-review screen `/o/[token]/review` — 5-star tap row + comment, gated on slipVerifiedAt

---

### V2.0 — Live & Social (Month 7-9)

**Goal**: เลียน TikTok Shop — ดึง shop owners ไลฟ์ขาย
**Success metric**: 100+ live broadcasts/day, live AOV +50% vs feed AOV

#### Live Shopping 💎🔥
- [x] Schema: `LiveBroadcast` + `LiveComment` + `LiveBroadcastStatus` enum (SCHEDULED/LIVE/ENDED/CANCELLED)
- [x] Provider-agnostic RTC stub `src/lib/live-rtc.ts` — swap one file when picking Agora / 100ms / LiveKit
- [x] Lifecycle endpoints: `GET /api/v1/live` (discovery), `GET/POST /api/v1/shops/:slug/live`, `GET/PATCH /api/v1/live/:id` (start / end / pin / update / cancel)
- [x] Buyer presence: `POST /api/v1/live/:id/heartbeat` (every 30s while watching)
- [x] Comments: `GET/POST /api/v1/live/:id/comments` (cursor-paginated, 3s polling on mobile; Pusher upgrade path open)
- [x] Push notification on go-live — fans out to every follower with `notifyLive=true` + registered Expo token
- [x] Seller-side: `/seller/live` cockpit (live cockpit with viewer count, pin product picker, end live) + `/seller/live/new` schedule form
- [x] Buyer-side: `/live/[id]` watch screen with cover poster, comments overlay, pinned-product floating card, composer
- [x] Home `<LiveRail />` showing currently-live + upcoming-in-24h with red ON-AIR pill
- [ ] Real video stream integration (currently poster + comments only — swap RTC stub when picking provider)
- [ ] Comments via Pusher/Ably (replace 3s polling)
- [ ] Replay (transcode + Cloudflare Stream)
- [ ] Decay-viewer-counts cron (V2.1)

#### Shop Stories (24h)
- [x] Schema: `ShopStory` (shopId, mediaUrl, mediaKind, caption, link, expiresAt, viewCount) + `ShopStoryMediaKind` enum + indexes
- [x] `GET /api/v1/stories` — grouped by shop, rail-friendly
- [x] `GET/POST /api/v1/shops/:slug/stories` — owner posts new story (24h TTL); buyers fetch active list
- [x] `POST /api/v1/shops/:slug/stories/:id/view` — view counter bump (anonymous)
- [x] Cron: `0 * * * *` `/api/v1/cron/expire-stories` — hard-delete expired rows hourly
- [x] Buyer-side: stories rail on feed top + full-screen viewer (`/stories/[slug]`) with auto-advance, tap-to-skip, progress bars, caption + CTA link
- [x] Seller-side mobile uploader — `/seller/stories` list + `/seller/stories/new` (image picker, caption, product-link picker)
- [x] Tap-to-buy linked product — viewer's CTA opens `/s/:slug/:productSlug`
- [ ] Video story support (mediaKind=VIDEO; viewer currently shows placeholder)

#### Group Buy / Pre-order
- [x] Schema: `GroupBuy` + `GroupBuyMember` + `GroupBuyStatus` enum (ACTIVE/FILLED/EXPIRED/CANCELLED) with tiered `pricePerTier` Json
- [x] Tier helpers `src/lib/group-buy.ts` — `parseTiers`, `validateTiers`, `priceForCurrentQty` (monotonic-qty + monotonic-price invariants)
- [x] `GET/POST /api/v1/shops/:slug/group-buys` — owner create (validates tiers + 30-day deadline cap + per-product uniqueness) + public list (ACTIVE + last-7-day FILLED)
- [x] `GET /api/v1/group-buys/:id` — public detail with current tier + next-tier hint
- [x] `POST /api/v1/group-buys/:id/join` — atomic transaction creates Order + GroupBuyMember + bumps `currentQty`, race-safe on last spot, flips status to FILLED + push owner
- [x] `DELETE /api/v1/group-buys/:id` — owner cancel (ACTIVE only)
- [x] Cron `/api/v1/cron/expire-group-buys` every 10 min — past-deadline ACTIVE → EXPIRED, member orders → CANCELLED + escrow refund + buyer push
- [x] Mobile `<GroupBuyRail />` on shop page — live progress bar, countdown, current-tier price, self-hides when empty
- [x] Mobile `/group-buy/[id]` buyer detail/join screen — tier table, countdown, qty selector, customer form, share-to-LINE CTA, navigates to `/checkout/[token]` after join
- [x] Seller-side mobile create screen — `/seller/group-buys` list (live progress + cancel) + `/seller/group-buys/new` 5-step form (product picker, title, min/max qty, duration presets 24h/48h/72h/7d, 1–3 tier ladder)
- [ ] Final-tier rebate on FILL (currently join-time price-lock; refunding the diff is V2.1)

#### Voice-to-Product (AI)
- [ ] Whisper API (OpenAI) → product name + description
- [ ] Image AI describe (GPT-4 Vision) → auto-fill product detail

---

### V3.0 — B2B & Marketplace API (Month 10-12)

**Goal**: ขยับจาก D2C SaaS → infrastructure layer ของ commerce ไทย

#### Wholesale Tier
- [ ] Tier pricing (qty-based)
- [ ] B2B-only products (visibility flag)
- [ ] Net 30 / Net 60 (escrow แบบยาว)
- [ ] Quote request flow

#### Public API + Webhooks
- [ ] OAuth2 app registration (`/dashboard/api-keys`)
- [ ] Rate limit per app (Upstash Redis)
- [ ] Webhook outbound: `order.created`, `order.paid`, `slip.verified`
- [ ] Public docs site (Mintlify หรือ self-host)

#### POS / ERP Integration
- [ ] Loyverse / FlowAccount adapters
- [ ] Inventory sync 2-way

#### White-label
- [ ] Custom domain per shop (Vercel domains API)
- [ ] Custom theme + logo per shop in mobile (deep linkable)

---

## 🗄 Backend Schema Changes (per phase)

### V0.5 (minimal)
```prisma
// User
expoPushToken    String?
```

### V1.0
```prisma
// User
favoriteShops    ShopFavorite[]
followedShops    ShopFollow[]
recentSearches   String[]   @default([])

// Shop
kycStatus        KycStatus  @default(NONE)
trustScore       Int        @default(50)

enum KycStatus { NONE PENDING VERIFIED REJECTED }

model ShopFavorite {
  userId    String
  shopId    String
  createdAt DateTime @default(now())
  @@id([userId, shopId])
}

model ShopFollow {
  userId         String
  shopId         String
  notifyNew      Boolean  @default(true)
  notifyLive     Boolean  @default(true)
  createdAt      DateTime @default(now())
  @@id([userId, shopId])
}

model ProductView {
  id         String   @id @default(cuid())
  userId     String?
  productId  String
  viewedAt   DateTime @default(now())
  @@index([userId, viewedAt])
  @@index([productId, viewedAt])
}
```

### V1.5 (shipped)
```prisma
// Dispute model + enums (see prisma/schema.prisma for full definition)
model Dispute {
  id      String        @id @default(cuid())
  orderId String
  order   Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  reason  DisputeReason
  status  DisputeStatus @default(OPEN)
  evidence Json         @default("[]")
  // … see schema.prisma for openedBy*, resolution, resolvedBy*
}

enum DisputeReason { NOT_RECEIVED WRONG_ITEM DAMAGED NOT_AS_DESCRIBED PAYMENT_ISSUE OTHER }
enum DisputeStatus { OPEN AWAITING_SHOP_RESPONSE AWAITING_BUYER_RESPONSE RESOLVED_REFUND RESOLVED_REPLACE RESOLVED_NO_ACTION CLOSED }

model AffiliatePayout {
  id             String                @id @default(cuid())
  userId         String
  amountSatang   Int
  promptpayId    String
  status         AffiliatePayoutStatus @default(REQUESTED)
  providerRef    String?
  rejectedReason String?
  // …
}

enum AffiliatePayoutStatus { REQUESTED APPROVED PAID REJECTED CANCELLED }

// Shop additions
Shop.affiliateRatePct Int?  // 0–10, default 2%

// Order additions (V1.5)
Order.referrerUserId String?
Order.referrerCode   String?

// Pending: EscrowHold + buyer-confirm flow
```

### V2.0 (shipped)
```prisma
model LiveBroadcast {
  id                String              @id @default(cuid())
  shopId            String
  title             String
  coverImageUrl     String?
  status            LiveBroadcastStatus @default(SCHEDULED)
  rtcProvider       String?
  rtcChannelId      String?
  rtcPublishToken   String?
  rtcSubscribeToken String?
  pinnedProductSlug String?
  viewerCount       Int                 @default(0)
  totalViews        Int                 @default(0)
  // … see schema.prisma
  comments          LiveComment[]
}

enum LiveBroadcastStatus { SCHEDULED LIVE ENDED CANCELLED }

model LiveComment {
  id          String  @id @default(cuid())
  broadcastId String
  userId      String?
  displayName String
  body        String
  isSystem    Boolean @default(false)
  deleted     Boolean @default(false)
  createdAt   DateTime @default(now())
}

model ShopStory {  // V2.0 already shipped
  // … see schema.prisma
}
```

---

## 🔌 API Endpoints to Add

### V0.5
- [ ] `POST /api/v1/auth/line-mobile` — exchange LINE id_token → JWT (7-day)
- [ ] `POST /api/v1/auth/refresh` — refresh JWT
- [ ] `POST /api/v1/me/push-token` — register Expo push token
- [ ] `DELETE /api/v1/me/push-token` — on logout

### V1.0
- [ ] `GET /api/v1/feed?cursor=&category=&filter=` — discovery
- [ ] `GET /api/v1/search?q=&category=&sort=&filter=`
- [ ] `GET /api/v1/me` — user profile + cross-shop summary
- [ ] `GET /api/v1/me/orders?cursor=` — cross-shop order history
- [ ] `GET /api/v1/me/favorites`
- [ ] `POST /api/v1/me/favorites` / `DELETE`
- [ ] `POST /api/v1/shops/:slug/follow` / `DELETE`
- [ ] `GET /api/v1/me/wallet` — loyalty points + coupons cross-shop
- [ ] `GET /api/v1/categories` — category list with shop counts

### V1.5
- [ ] `POST /api/v1/me/kyc/start` — initiate KYC flow
- [ ] `POST /api/v1/admin/kyc/:userId/approve`
- [ ] `POST /api/v1/orders/:token/dispute`
- [ ] `GET /api/v1/admin/disputes`
- [ ] `POST /api/v1/admin/disputes/:id/resolve`
- [ ] `POST /api/v1/billing/escrow-release` — buyer confirms

### V2.0
- [ ] `POST /api/v1/live/start` (seller)
- [ ] `GET /api/v1/live/active` (buyer feed)
- [ ] `POST /api/v1/live/:id/comments` (buyer)
- [ ] WebSocket / SSE: `/api/v1/live/:id/stream` (events)

---

## 🛡 Trust & Buyer Protection — Layered Strategy

ดู `docs/trust-layer.md` (TODO: เขียน) — สรุปสั้น ๆ:

| Layer | When | What |
|---|---|---|
| **Pre-purchase** | ก่อนซื้อ | KYC + Trust Score + Verified Badge |
| **At checkout** | ตอน checkout | Direct Pay (default) vs Protected Pay (escrow, +1.5%) |
| **Post-purchase** | หลังซื้อ | Dispute flow + auto-refund rules |
| **Reputation** | ตลอด | Slip-verified reviews only + public dispute history |

**Strategic call**: V0.5–V1.0 ใช้ Direct Pay only แต่บังคับ Verified shop เท่านั้นที่ขึ้น marketplace feed
ร้าน unverified ขายได้แต่ผ่าน link เท่านั้น (เหมือน SalePage web ตอนนี้)

---

## 📣 Go-To-Market

### Phase 1 — Existing Shop Owners (V0.5 launch)
- [ ] Email + LINE OA broadcast ถึง shop owners ทั้งหมด
- [ ] Generate QR แอป + waybill template สำหรับใส่ในแพ็คเกจ
- [ ] Affiliate-style: ร้านให้ลูกค้าโหลดแอป → ร้านได้ slip credit เพิ่ม

### Phase 2 — Niche Vertical Push (V1.0)
- [ ] Target #1: **อาหารแห้ง / ของฝาก** (repeat purchase สูง)
- [ ] Target #2: **เสื้อผ้าแม่ค้าไลฟ์** (TikTok/FB) — pain คือ slip รัวๆ
- [ ] Target #3: **Beauty / Skincare** — margin สูง, รีวิวจริงสำคัญ
- [ ] Avoid early: Electronics (high AOV + dispute risk), Pre-order

### Phase 3 — Influencer + Affiliate (V1.5)
- [ ] Micro-influencer kit (LIFF + ลิงก์ tracked)
- [ ] Top-tier creator partnership (revenue share)
- [ ] Brand ambassador program

---

## ⚠️ Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ลูกค้าโดนโกง → bad PR | High | Critical | Trust Layer (V1.5) + Verified-only feed |
| SlipOK quota exhausted ตอนปกติ | Medium | High | Slip credits wallet + multi-provider fallback (Easyslip) |
| App Store reject (PromptPay/IAP) | Medium | High | ใช้ external link ไป QR (ไม่ใช่ in-app payment) — exempt จาก IAP |
| Shopee retaliation (price war) | Medium | Medium | จุดยืน "0% fee" + niche vertical ไม่ใช่ horizontal |
| Performance issue feed > 100k shops | Medium | Medium | Pagination + Postgres index + cache layer (Upstash) |
| LINE LIFF deprecation/policy change | Low | High | Independent JWT auth + email magic link backup |
| Cashflow ของ SalePage เอง | Medium | High | Subscription tier มีกำไรอยู่แล้ว — ไม่พึ่ง transaction fee |

---

## 🚦 Definition of Done (per Phase)

### V0.5 ✅
- ติดตั้งแอปจาก TestFlight/Play Internal สำเร็จบนเครื่องจริง
- Login ผ่าน LINE → ดูหน้าร้าน → checkout → ส่งสลิป → ได้รับ push notification ครบทุก state
- Slip verify success rate ≥ 95% บน production sample
- Sentry error rate < 0.5%

### V1.0 ✅
- Discovery feed render ภายใน 1.5s p95
- Search latency < 200ms p95
- Verified shop ≥ 200 ร้าน
- Cross-shop cart checkout สำเร็จ ≥ 95%

### V1.5 ✅
- KYC approval rate ≥ 80% (auto + manual)
- Dispute resolution time median < 48h
- Refund rate < 1%

### V2.0 ✅
- Live concurrency รองรับ 1,000 viewers/broadcast
- Latency video < 3s end-to-end
- Live conversion rate > feed conversion rate

### V3.0 ✅
- Public API uptime ≥ 99.9%
- 3+ paying B2B customer integrations live

---

## 📝 Open Questions / Decisions Needed

- [ ] **Escrow provider**: 2C2P vs Beam vs KBank Open API — ต้อง test fee structure
- [ ] **Live RTC**: Agora vs 100ms vs LiveKit — ขึ้นกับราคา + Thai PoP
- [ ] **KYC**: NDID (Thai-native, slow) vs Stripe Identity (global, fast)
- [ ] **Search**: Postgres FTS อยู่ได้ถึงกี่ shop? วัด p95 ที่ 50k/100k/200k
- [ ] **Real-time**: Pusher (paid, easy) vs Supabase Realtime (free tier OK?) vs self-host
- [ ] **AI describe** (V2): GPT-4 Vision vs Claude Vision vs open-source (LLaVA self-host)
- [ ] **App store fee**: PromptPay = external payment → ไม่โดน 30% (ต้อง confirm กับ legal)

---

## 📂 Working Directory Layout

```
salepage/
├── src/                    # Next.js web (existing)
├── prisma/                 # shared schema
├── mobile/                 # NEW: React Native + Expo
│   ├── app/                # Expo Router screens
│   ├── src/
│   │   ├── components/
│   │   ├── lib/            # api client, auth, storage
│   │   ├── hooks/
│   │   ├── store/          # Zustand
│   │   └── types/          # share with web via path
│   ├── assets/
│   ├── app.config.ts
│   ├── eas.json
│   ├── package.json
│   └── tsconfig.json
└── ROADMAP.md              # this file
```

Shared TypeScript types between web & mobile via TS path: mobile imports from `../src/lib/...` (read-only)
หรือถ้า monorepo จริง — extract เป็น `packages/shared`

---

_Last updated: 2026-05-26 — initial draft_
