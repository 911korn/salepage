import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe, getSiteUrl, stripeLocale } from "@/lib/stripe";
import {
  SLIP_PACK_KEYS,
  SLIP_PACKS,
  slipPackPriceId,
  type SlipPackKey,
} from "@/lib/slip-credits";

const Body = z.object({
  pack: z.enum(SLIP_PACK_KEYS as [SlipPackKey, ...SlipPackKey[]]),
  shopSlug: z.string().min(1),
  locale: z.enum(["th", "en"]).optional().default("th"),
});

/**
 * POST /api/v1/billing/checkout-credits — buy a slip-credit top-up pack.
 *
 * Auth required (must own the shop). Card OR PromptPay; mode:payment so
 * Stripe doesn't try to set up a subscription. On checkout.session.completed
 * the webhook reads metadata { type:"slip-credits", shopId, slips } and
 * increments shop.slipCredits by `slips`.
 *
 * Why we lock the buyer to the shop owner: anyone with a session shouldn't be
 * able to dump credits into someone else's wallet, even by mistake. The
 * Stripe checkout page additionally enforces email match for the customer.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("unauthorized", "ต้อง sign in ก่อนถึงจะซื้อเครดิตได้", 401);
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { pack, shopSlug, locale } = parsed.data;

  const shop = await db.shop.findUnique({
    where: { slug: shopSlug },
    select: { id: true, slug: true, name: true, ownerId: true, suspended: true },
  });
  if (!shop) return fail("shop_not_found", "ไม่พบร้านนี้", 404);
  if (shop.ownerId !== session.user.id) {
    return fail("forbidden", "ซื้อได้เฉพาะร้านของตัวเอง", 403);
  }
  if (shop.suspended) {
    return fail("shop_suspended", "ร้านนี้ถูกระงับ ติดต่อผู้ดูแล", 403);
  }

  const meta = SLIP_PACKS[pack];
  const priceId = slipPackPriceId(pack);
  if (!priceId) {
    return fail(
      "stripe_price_missing",
      `STRIPE_PRICE_SLIPS_${pack.toUpperCase()} not configured`,
      500,
    );
  }

  try {
    const stripe = getStripe();
    const base = getSiteUrl();
    const localePrefix = locale === "th" ? "" : `/${locale}`;

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ["card", "promptpay"],
      customer_email: session.user.email ?? undefined,
      billing_address_collection: "auto",
      locale: stripeLocale(locale) as unknown as undefined,
      metadata: {
        type: "slip-credits",
        pack,
        slips: String(meta.slips),
        shopId: shop.id,
        shopSlug: shop.slug,
        ownerId: shop.ownerId,
      },
      payment_intent_data: {
        metadata: {
          type: "slip-credits",
          pack,
          slips: String(meta.slips),
          shopId: shop.id,
          shopSlug: shop.slug,
        },
      },
      success_url: `${base}${localePrefix}/dashboard/settings?credits=ok&pack=${pack}`,
      cancel_url: `${base}${localePrefix}/dashboard/settings?credits=cancel`,
    });

    return ok({
      sessionId: checkout.id,
      url: checkout.url,
      pack: meta,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe error";
    console.error("[checkout-credits] stripe error:", message);
    return fail("stripe_error", message, 502);
  }
}
