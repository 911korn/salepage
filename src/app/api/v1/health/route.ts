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
      "GET    /api/v1/shops/:slug",
      "GET    /api/v1/shops/:slug/products",
      "GET    /api/v1/shops/:slug/products/:productSlug",
      "GET    /api/v1/billing/plans",
      "POST   /api/v1/billing/checkout",
      "POST   /api/v1/billing/portal",
      "POST   /api/v1/billing/webhook  (Stripe signed)",
    ],
  });
}
