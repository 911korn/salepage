import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({
    name: "SalePage API",
    version: "v1",
    time: new Date().toISOString(),
    endpoints: [
      "GET    /api/v1/health",
      "POST   /api/v1/promptpay/qr",
      "GET    /api/v1/promptpay/qr?id=...&amount=...",
      "POST   /api/v1/slip/verify",
      "GET    /api/v1/shops",
      "POST   /api/v1/shops                              (auth)",
      "GET    /api/v1/shops/:slug",
      "PATCH  /api/v1/shops/:slug                       (auth, owner)",
      "GET    /api/v1/shops/:slug/products",
      "POST   /api/v1/shops/:slug/products               (auth, owner)",
      "GET    /api/v1/shops/:slug/products/:productSlug",
      "PATCH  /api/v1/shops/:slug/products/:productSlug  (auth, owner)",
      "DELETE /api/v1/shops/:slug/products/:productSlug  (auth, owner)",
      "POST   /api/v1/shops/:slug/follow                 (auth — V1 marketplace)",
      "DELETE /api/v1/shops/:slug/follow                 (auth — V1 marketplace)",
      "POST   /api/v1/shops/:slug/favorite               (auth — V1 marketplace)",
      "DELETE /api/v1/shops/:slug/favorite               (auth — V1 marketplace)",
      "POST   /api/v1/orders                             (public)",
      "GET    /api/v1/orders/:token                      (public)",
      "POST   /api/v1/orders/:token/slip                 (public — uploads slip)",
      "PATCH  /api/v1/orders/:token/status               (auth, shop owner)",
      "POST   /api/v1/upload                             (auth — Vercel Blob)",
      "POST   /api/v1/auth/line-mobile                   (mobile — exchange LINE id_token → JWT)",
      "POST   /api/v1/auth/refresh                       (mobile — refresh JWT)",
      "GET    /api/v1/me                                 (auth — profile + counts)",
      "GET    /api/v1/me/orders                          (auth — cross-shop history)",
      "GET    /api/v1/me/favorites                       (auth — saved shops)",
      "POST   /api/v1/me/push-token                      (auth — register Expo token)",
      "DELETE /api/v1/me/push-token                      (auth — clear on logout)",
      "GET    /api/v1/feed?tab=for-you|new|following     (V1 — discovery)",
      "GET    /api/v1/search?q=...                       (V1 — full-text)",
      "GET    /api/v1/categories                         (V1 — with counts)",
      "GET    /api/v1/billing/plans",
      "POST   /api/v1/billing/checkout",
      "POST   /api/v1/billing/portal",
      "POST   /api/v1/billing/webhook  (Stripe signed)",
    ],
  });
}
