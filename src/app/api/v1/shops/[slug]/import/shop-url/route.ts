import { z } from "zod";
import { resolveSession } from "@/lib/api-auth";
import { ok, fail, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { crawlShopUrl } from "@/lib/import/shop-crawl";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/v1/shops/:slug/import/shop-url
 *
 * Single-shot "paste your shop link, AI does the rest" importer. Returns
 * up to 100 normalized products with per-product failures. The caller
 * commits via the existing `/import/url` endpoint with `mode:"commit"`.
 */
const Body = z.object({
  url: z.string().url(),
});

export const runtime = "nodejs";
// Shopify call is fast (one JSON request) but Lazada walks 5 pages then
// 100 product fetches, and AI extraction adds a Claude round-trip. 90 s
// keeps everything well within budget without timing out the seller's
// browser.
export const maxDuration = 90;

export async function POST(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านค้านี้", 404);
  if (shop.ownerId !== session.user.id)
    return fail("forbidden", "ไม่มีสิทธิ์", 403);

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await crawlShopUrl(parsed.data.url);
    return ok({
      platform: result.platform,
      totalDetected: result.totalDetected,
      successes: result.products,
      failures: result.failures,
    });
  } catch (e) {
    return fail(
      "shop_crawl_failed",
      e instanceof Error ? e.message : "ดึงข้อมูลจากร้านไม่สำเร็จ",
      400,
    );
  }
}
