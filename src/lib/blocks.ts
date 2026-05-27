import { db } from "./db";

/**
 * Apple Guideline 1.2 — return the set of user IDs the viewer has
 * blocked. Discovery queries use this to exclude blocked sellers from
 * search, product feeds, follow lists, and recommendations so blocked
 * content is removed from the viewer's feed instantly.
 *
 * Returns an empty array for anonymous viewers — they can still see
 * everything (matches the spec; only signed-in users have block lists).
 */
export async function getBlockedOwnerIds(viewerId: string | null): Promise<string[]> {
  if (!viewerId) return [];
  const rows = await db.userBlock.findMany({
    where: { blockerId: viewerId },
    select: { blockeeId: true },
  });
  return rows.map((r) => r.blockeeId);
}
