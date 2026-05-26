import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db, LiveBroadcastStatus } from "@/lib/db";
import { pushToTokens } from "@/lib/push-notify";
import { revokeBroadcast } from "@/lib/live-rtc";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/live/:id
 *
 * Public — full broadcast detail for the watch screen. Includes the public
 * `rtcSubscribeToken` so the mobile player can connect, but never the
 * `rtcPublishToken` (seller-only).
 *
 * If the broadcast has a `pinnedProductSlug`, we resolve it inline so the
 * watch overlay can render the product card without a second fetch.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const broadcast = await db.liveBroadcast.findUnique({
    where: { id },
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
      // Public connect handles only.
      rtcProvider: true,
      rtcChannelId: true,
      rtcSubscribeToken: true,
      playbackUrl: true,
      shop: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoText: true,
          logoUrl: true,
          themeColor: true,
          kycStatus: true,
          trustScore: true,
        },
      },
    },
  });
  if (!broadcast) return fail("not_found", "ไม่พบไลฟ์นี้", 404);

  // Resolve pinned product (if any) so the watch overlay has price + image
  // without an extra round-trip.
  let pinnedProduct: {
    slug: string;
    name: string;
    priceSatang: number;
    compareAtSatang: number | null;
    imageUrls: string[];
  } | null = null;
  if (broadcast.pinnedProductSlug) {
    const p = await db.product.findUnique({
      where: {
        shopId_slug: {
          shopId: broadcast.shop.id,
          slug: broadcast.pinnedProductSlug,
        },
      },
      select: {
        slug: true,
        name: true,
        priceSatang: true,
        compareAtSatang: true,
        imageUrls: true,
      },
    });
    pinnedProduct = p;
  }

  return ok({ broadcast, pinnedProduct });
}

/**
 * PATCH /api/v1/live/:id
 *
 * Owner-only lifecycle transitions:
 *
 *   - start   SCHEDULED → LIVE    (sets startedAt, fans out push to followers)
 *   - end     LIVE      → ENDED   (sets endedAt, revokes RTC tokens)
 *   - pin     LIVE only           (rotates pinnedProductSlug; null to clear)
 *   - update  any non-terminal    (title/description/coverImage)
 *   - cancel  SCHEDULED → CANCELLED (admin-style; doesn't notify)
 */
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("end") }),
  z.object({
    action: z.literal("pin"),
    productSlug: z.string().max(120).nullable(),
  }),
  z.object({
    action: z.literal("update"),
    title: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    coverImageUrl: z.string().url().max(500).nullable().optional(),
  }),
  z.object({ action: z.literal("cancel") }),
]);

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const { id } = await ctx.params;
  const broadcast = await db.liveBroadcast.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      title: true,
      shop: {
        select: { id: true, slug: true, name: true, ownerId: true },
      },
    },
  });
  if (!broadcast) return fail("not_found", "ไม่พบไลฟ์นี้", 404);
  if (broadcast.shop.ownerId !== session.user.id) {
    return fail("forbidden", "เฉพาะเจ้าของร้านเท่านั้น", 403);
  }

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  switch (input.action) {
    case "start": {
      if (broadcast.status !== LiveBroadcastStatus.SCHEDULED) {
        return fail(
          "invalid_transition",
          `Cannot start a broadcast in status ${broadcast.status}`,
          409,
        );
      }
      const now = new Date();
      await db.liveBroadcast.update({
        where: { id },
        data: {
          status: LiveBroadcastStatus.LIVE,
          startedAt: now,
        },
      });
      // Fire-and-forget fan-out to followers who opted in to live notifs.
      void notifyFollowersGoLive(broadcast.shop.id, {
        broadcastId: id,
        shopName: broadcast.shop.name,
        shopSlug: broadcast.shop.slug,
        title: broadcast.title,
      }).catch(() => undefined);
      return ok({ id, status: LiveBroadcastStatus.LIVE });
    }
    case "end": {
      if (broadcast.status !== LiveBroadcastStatus.LIVE) {
        return fail(
          "invalid_transition",
          `Cannot end a broadcast in status ${broadcast.status}`,
          409,
        );
      }
      const now = new Date();
      await db.liveBroadcast.update({
        where: { id },
        data: {
          status: LiveBroadcastStatus.ENDED,
          endedAt: now,
          // Reset live-only counters so the next sweep doesn't see ghost viewers.
          viewerCount: 0,
        },
      });
      void revokeBroadcast(id).catch(() => undefined);
      return ok({ id, status: LiveBroadcastStatus.ENDED });
    }
    case "pin": {
      if (broadcast.status !== LiveBroadcastStatus.LIVE) {
        return fail(
          "invalid_transition",
          "ปักหมุดสินค้าได้เฉพาะตอนไลฟ์เท่านั้น",
          409,
        );
      }
      await db.liveBroadcast.update({
        where: { id },
        data: { pinnedProductSlug: input.productSlug },
      });
      return ok({ id, pinnedProductSlug: input.productSlug });
    }
    case "update": {
      if (
        broadcast.status === LiveBroadcastStatus.ENDED ||
        broadcast.status === LiveBroadcastStatus.CANCELLED
      ) {
        return fail(
          "invalid_transition",
          "Cannot edit an ended/cancelled broadcast",
          409,
        );
      }
      await db.liveBroadcast.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.coverImageUrl !== undefined
            ? { coverImageUrl: input.coverImageUrl }
            : {}),
        },
      });
      return ok({ id });
    }
    case "cancel": {
      if (broadcast.status !== LiveBroadcastStatus.SCHEDULED) {
        return fail(
          "invalid_transition",
          `Cannot cancel a broadcast in status ${broadcast.status}`,
          409,
        );
      }
      await db.liveBroadcast.update({
        where: { id },
        data: { status: LiveBroadcastStatus.CANCELLED },
      });
      void revokeBroadcast(id).catch(() => undefined);
      return ok({ id, status: LiveBroadcastStatus.CANCELLED });
    }
  }
}

/**
 * Fan-out to every follower of `shopId` who has `notifyLive=true` AND a
 * registered Expo push token. We push directly to tokens (skip pushToUser)
 * so we can hit hundreds of devices in a single Expo batch.
 */
async function notifyFollowersGoLive(
  shopId: string,
  payload: {
    broadcastId: string;
    shopName: string;
    shopSlug: string;
    title: string;
  },
): Promise<void> {
  const follows = await db.shopFollow.findMany({
    where: {
      shopId,
      notifyLive: true,
      user: { expoPushToken: { not: null } },
    },
    select: { user: { select: { expoPushToken: true } } },
  });
  const tokens = follows
    .map((f) => f.user.expoPushToken)
    .filter((t): t is string => Boolean(t));
  if (tokens.length === 0) return;

  await pushToTokens(tokens, {
    title: `🔴 ${payload.shopName} กำลังไลฟ์!`,
    body: payload.title,
    data: {
      kind: "live.started",
      broadcastId: payload.broadcastId,
      shopSlug: payload.shopSlug,
    },
  });
}
