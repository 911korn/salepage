import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { getProductsFeed } from "@/lib/products-feed-shared";

/**
 * GET /api/v1/products-feed?cursor=&category=&verified=&sort=
 *
 * Thin HTTP wrapper around `getProductsFeed` so this mobile route and
 * the web marketplace at /shops both see the same product list +
 * ranking (911korn 2026-05-27 "ใช้ api อันเดียวกัน").
 */
const QuerySchema = z.object({
  cursor: z.string().optional(),
  category: z.string().optional(),
  sort: z
    .enum(["relevance", "sold", "newest", "price-asc", "price-desc"])
    .default("relevance"),
  verified: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return fail("invalid_query", "Query string ไม่ถูกต้อง", 422);
  }
  const { cursor, category, sort, verified } = parsed.data;
  const result = await getProductsFeed({ cursor, category, sort, verified });
  return ok(result, {
    headers: {
      "Cache-Control":
        "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
