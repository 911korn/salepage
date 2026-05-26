import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { resolveSession } from "@/lib/api-auth";

/**
 * GET /api/v1/me — current user's profile + cross-shop summary counts.
 *
 * Used by the mobile profile tab to render avatar/name + counts at a glance.
 * Auth required (Bearer for mobile, cookie session for web).
 */
export async function GET(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;
  const { user } = session;

  const [favoriteCount, followingCount, orderCount] = await Promise.all([
    db.shopFavorite.count({ where: { userId: user.id } }),
    db.shopFollow.count({ where: { userId: user.id } }),
    db.order.count({ where: { customerEmail: user.email } }),
  ]);

  return ok({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    favoriteCount,
    followingCount,
    orderCount,
  });
}
