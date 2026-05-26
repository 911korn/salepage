import { ok } from "@/lib/api";
import { db, ShopStatus } from "@/lib/db";

/**
 * GET /api/v1/stories
 *
 * Public discovery rail of active stories — used on the mobile home feed
 * above the shop cards. Groups by shop so the UI can render one circle
 * per shop with a "ring" indicator if any of its stories are unviewed.
 *
 * Sort: shops with the most-recent active story first. We don't personalize
 * here (no follow-graph weighting yet) — V2.1 can layer that on once we
 * have view-state per user.
 */
export async function GET() {
  const now = new Date();

  // We grab up to 60 shops with active stories, then pull each shop's
  // most-recent 5 stories. The feed shows circles; tapping opens the viewer
  // which walks through all current stories for that shop.
  const recentStories = await db.shopStory.findMany({
    where: {
      expiresAt: { gt: now },
      shop: { status: ShopStatus.ACTIVE, suspended: false },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      mediaUrl: true,
      mediaKind: true,
      caption: true,
      linkProductSlug: true,
      linkUrl: true,
      viewCount: true,
      createdAt: true,
      expiresAt: true,
      shop: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoText: true,
          logoUrl: true,
          themeColor: true,
          kycStatus: true,
        },
      },
    },
  });

  // Group by shop. Map preserves insertion order (orderBy created desc),
  // so the freshest shop bubbles to the top.
  const groups = new Map<
    string,
    {
      shop: (typeof recentStories)[number]["shop"];
      stories: Array<{
        id: string;
        mediaUrl: string;
        mediaKind: "IMAGE" | "VIDEO";
        caption: string | null;
        linkProductSlug: string | null;
        linkUrl: string | null;
        viewCount: number;
        createdAt: Date;
        expiresAt: Date;
      }>;
    }
  >();
  for (const s of recentStories) {
    const existing = groups.get(s.shop.id);
    if (existing) {
      existing.stories.push({
        id: s.id,
        mediaUrl: s.mediaUrl,
        mediaKind: s.mediaKind,
        caption: s.caption,
        linkProductSlug: s.linkProductSlug,
        linkUrl: s.linkUrl,
        viewCount: s.viewCount,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      });
    } else {
      groups.set(s.shop.id, {
        shop: s.shop,
        stories: [
          {
            id: s.id,
            mediaUrl: s.mediaUrl,
            mediaKind: s.mediaKind,
            caption: s.caption,
            linkProductSlug: s.linkProductSlug,
            linkUrl: s.linkUrl,
            viewCount: s.viewCount,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
          },
        ],
      });
    }
  }

  return ok({
    shops: Array.from(groups.values()).map((g) => ({
      shop: g.shop,
      stories: g.stories.slice(0, 5),
    })),
  });
}
