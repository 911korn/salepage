import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, LiveBroadcastStatus } from "@/lib/db";
import { provisionBroadcast } from "@/lib/live-rtc";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/v1/shops/:slug/live
 *   Public — list this shop's recent broadcasts (LIVE + SCHEDULED + last 10 ENDED).
 *
 * POST /api/v1/shops/:slug/live
 *   Owner-only — create a new SCHEDULED broadcast and provision RTC tokens.
 *   Seller calls /start later to flip it to LIVE.
 */
const CreateBody = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().max(500).optional(),
  scheduledAt: z.string().datetime().optional(),
  pinnedProductSlug: z.string().max(120).optional(),
});

export async function GET(_request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);

  const broadcasts = await db.liveBroadcast.findMany({
    where: {
      shopId: shop.id,
      // Hide CANCELLED from public list — they're operational noise.
      status: { not: LiveBroadcastStatus.CANCELLED },
    },
    orderBy: [
      // LIVE first, then SCHEDULED upcoming, then most recently ENDED.
      { startedAt: "desc" },
      { scheduledAt: "desc" },
      { createdAt: "desc" },
    ],
    take: 20,
    select: {
      id: true,
      title: true,
      description: true,
      coverImageUrl: true,
      status: true,
      scheduledAt: true,
      startedAt: true,
      endedAt: true,
      viewerCount: true,
      totalViews: true,
      pinnedProductSlug: true,
      replayUrl: true,
    },
  });

  return ok({ broadcasts });
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);
  if (shop.ownerId !== session.user.id) {
    return fail("forbidden", "เฉพาะเจ้าของร้านเท่านั้น", 403);
  }

  const parsed = await parseJson(request, CreateBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // Step 1: insert the row so we have an ID for the RTC channel name.
  const created = await db.liveBroadcast.create({
    data: {
      shopId: shop.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      coverImageUrl: input.coverImageUrl ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      pinnedProductSlug: input.pinnedProductSlug ?? null,
      status: LiveBroadcastStatus.SCHEDULED,
    },
    select: { id: true },
  });

  // Step 2: provision RTC tokens. Stub today, real provider later. We
  // persist them so the seller can /start without a second handshake.
  const creds = provisionBroadcast(created.id);
  const fullRow = await db.liveBroadcast.update({
    where: { id: created.id },
    data: {
      rtcProvider: creds.rtcProvider,
      rtcChannelId: creds.rtcChannelId,
      rtcPublishToken: creds.rtcPublishToken,
      rtcSubscribeToken: creds.rtcSubscribeToken,
      playbackUrl: creds.playbackUrl,
    },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledAt: true,
      rtcProvider: true,
      rtcChannelId: true,
      rtcPublishToken: true,
      rtcSubscribeToken: true,
      playbackUrl: true,
      createdAt: true,
    },
  });

  return ok({ broadcast: fullRow }, { status: 201 });
}
