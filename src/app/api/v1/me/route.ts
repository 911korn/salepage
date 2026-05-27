import { z } from "zod";
import { ok, fail, parseJson } from "@/lib/api";
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

/**
 * PATCH /api/v1/me — update name + avatar. 911korn 2026-05-27 "รูปโปร์ไฟล์
 * กับชื่อ เปลี่ยนไม่ได้". Empty string clears the field; `image` URL must
 * point at our own Vercel Blob bucket so we don't proxy arbitrary URLs.
 */
const PatchBody = z.object({
  name: z.string().min(1).max(80).optional().nullable(),
  image: z.string().url().max(500).optional().nullable(),
});

export async function PATCH(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const parsed = await parseJson(request, PatchBody);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name?.trim() || null;
  if (input.image !== undefined) data.image = input.image || null;

  if (Object.keys(data).length === 0) {
    return fail("no_fields", "ไม่มีฟิลด์ที่ต้องอัปเดต", 400);
  }

  const user = await db.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, name: true, email: true, image: true },
  });
  return ok({ user });
}
