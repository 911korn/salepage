import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
import { resolveSession } from "@/lib/api-auth";
import { db } from "@/lib/db";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/v1/shops/:slug/stories
 *   Public. Returns the shop's currently-active stories (expiresAt > now)
 *   in chronological order so the viewer plays them oldest → newest.
 *
 * POST /api/v1/shops/:slug/stories
 *   Owner-only. Creates a new story with a 24-hour TTL. `mediaUrl` is a
 *   Vercel Blob URL produced by the mobile uploader (`/api/v1/upload`).
 */
const TTL_MS = 24 * 60 * 60 * 1000;

const CreateBody = z.object({
  mediaUrl: z.string().url(),
  mediaKind: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
  caption: z.string().max(280).optional(),
  linkProductSlug: z.string().max(120).optional(),
  linkUrl: z.string().url().max(500).optional(),
});

export async function GET(_request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const shop = await db.shop.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!shop) return fail("not_found", "ไม่พบร้านนี้", 404);

  const stories = await db.shopStory.findMany({
    where: {
      shopId: shop.id,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
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
    },
  });

  return ok({ stories });
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

  const story = await db.shopStory.create({
    data: {
      shopId: shop.id,
      mediaUrl: input.mediaUrl,
      mediaKind: input.mediaKind,
      caption: input.caption ?? null,
      linkProductSlug: input.linkProductSlug ?? null,
      linkUrl: input.linkUrl ?? null,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
    select: {
      id: true,
      mediaUrl: true,
      mediaKind: true,
      caption: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return ok({ story }, { status: 201 });
}
