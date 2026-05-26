import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, LiveBroadcastStatus } from "@/lib/db";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/live/:id/comments?since=<commentId>
 *
 * Public — paginated tail of recent comments. The mobile watch screen
 * polls this every ~3s during V2.0 (real-time via Pusher lands later).
 *
 * `since` cursor lets the client request only NEW comments since the
 * last poll; without it we return the most-recent 50 (initial load).
 *
 * POST /api/v1/live/:id/comments
 *
 * Open to anonymous viewers — they pass a `displayName` (≤ 30 chars).
 * Authenticated viewers get their User.name auto-attached for moderation.
 *
 * Comments are dropped silently (HTTP 409 with `not_live`) once the
 * broadcast ends so we don't accumulate post-broadcast spam.
 */
const PostBody = z.object({
  body: z.string().trim().min(1).max(280),
  displayName: z.string().trim().min(1).max(30),
});

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const since = url.searchParams.get("since");

  const broadcast = await db.liveBroadcast.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!broadcast) return fail("not_found", "ไม่พบไลฟ์นี้", 404);

  // We always sort by createdAt ASC for chat-like rendering. Cursor mode
  // uses `id > since` to avoid clock-skew weirdness — the cuid is
  // monotonic enough for our purposes.
  const where: Record<string, unknown> = {
    broadcastId: id,
    deleted: false,
  };
  if (since) where.id = { gt: since };

  const comments = await db.liveComment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      displayName: true,
      body: true,
      isSystem: true,
      createdAt: true,
    },
  });

  return ok({ comments });
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const broadcast = await db.liveBroadcast.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!broadcast) return fail("not_found", "ไม่พบไลฟ์นี้", 404);
  if (broadcast.status !== LiveBroadcastStatus.LIVE) {
    return fail("not_live", "ไลฟ์ปิดแล้ว", 409);
  }

  const parsed = await parseJson(request, PostBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // If the viewer is logged in, override the displayName with their User.name
  // for moderation traceability. Logged-out viewers get their freeform name.
  const session = await resolveSession(request).catch(() => null);
  const userId = session && session.ok ? session.user.id : null;
  const displayName =
    session && session.ok && session.user.name
      ? session.user.name
      : input.displayName;

  const comment = await db.liveComment.create({
    data: {
      broadcastId: id,
      userId,
      displayName,
      body: input.body,
    },
    select: {
      id: true,
      displayName: true,
      body: true,
      isSystem: true,
      createdAt: true,
    },
  });

  return ok({ comment }, { status: 201 });
}
