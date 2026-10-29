import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getStripe, getSiteUrl } from "@/lib/stripe";

const Body = z.object({
  locale: z.enum(["th", "en"]).optional().default("th"),
});

/** POST /api/v1/billing/portal — Stripe billing portal for the SIGNED-IN
 *  user only (payment method, invoices). The customer id always comes from
 *  the session; this route used to accept any email/customerId in the body
 *  with no auth, which opened another customer's portal. */
export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { locale } = parsed.data;

  const sub = await db.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  });
  const cus = sub?.stripeCustomerId?.startsWith("cus_")
    ? sub.stripeCustomerId
    : session.user.stripeCustomerId;
  if (!cus?.startsWith("cus_")) {
    return fail("no_billing_account", "ยังไม่มีประวัติการชำระเงินในบัญชีนี้", 404);
  }

  try {
    const base = getSiteUrl();
    const localePrefix = locale === "th" ? "" : `/${locale}`;
    const portal = await getStripe().billingPortal.sessions.create({
      customer: cus,
      return_url: `${base}${localePrefix}/dashboard/settings#subscription`,
    });
    return ok({ url: portal.url });
  } catch (e) {
    console.error("[billing/portal]", e instanceof Error ? e.message : e);
    return fail(
      "portal_unavailable",
      "เปิดหน้าจัดการการชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งในอีกสักครู่",
      502,
    );
  }
}
