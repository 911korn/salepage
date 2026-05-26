import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { getDiscoveryFeed } from "@/lib/feed-shared";

/**
 * GET /api/v1/feed?cursor=&category=&tab=for-you|new|following
 *
 * V1.0 discovery feed. Tab semantics + ranking algorithm live in
 * `@/lib/feed-shared` so the web server pages (e.g. `/shops`) share the
 * exact same logic with this HTTP route (911korn 2026-05-27 "ทำให้มัน
 * ใช้ api อันเดียวกันนะ คอร์สแพลตฟอร์ม"). This handler just deals with
 * query parsing, auth-gating "following", and JSON shape.
 */
const QuerySchema = z.object({
  cursor: z.string().optional(),
  category: z.string().optional(),
  tab: z.enum(["for-you", "new", "following"]).optional(),
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
  const { cursor, category, tab = "for-you", verified } = parsed.data;

  let userId: string | undefined;
  if (tab === "following") {
    const session = await resolveSession(request);
    if (!session.ok) return session.response;
    userId = session.user.id;
  }

  const { shops, nextCursor } = await getDiscoveryFeed({
    cursor,
    category,
    tab,
    verified,
    userId,
  });
  return ok({ shops, nextCursor });
}
