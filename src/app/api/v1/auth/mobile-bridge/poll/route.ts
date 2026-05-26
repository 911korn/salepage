import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";

/**
 * GET /api/v1/auth/mobile-bridge/poll?bridge=ID
 *
 * Mobile app polls this every ~1.5s after kicking off the bridge. Returns
 * `{ token, user }` once /complete has minted the JWT. Marks `consumedAt`
 * on first read so a stolen bridgeId can't be replayed.
 */
const Query = z.object({
  bridge: z.string().min(20).max(50),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = Query.safeParse({
    bridge: url.searchParams.get("bridge") ?? "",
  });
  if (!parsed.success) {
    return fail("invalid_bridge", "bridgeId ไม่ถูกต้อง", 400);
  }

  const row = await db.mobileAuthBridge.findUnique({
    where: { id: parsed.data.bridge },
  });
  if (!row) {
    return fail("bridge_not_found", "ไม่พบ bridge", 404);
  }
  if (row.expiresAt < new Date()) {
    return fail("bridge_expired", "Bridge หมดอายุ กรุณาลองใหม่", 410);
  }
  if (row.consumedAt) {
    return fail("bridge_consumed", "Bridge นี้ถูกใช้ไปแล้ว", 410);
  }

  if (!row.token || !row.userId) {
    return ok({ pending: true as const });
  }

  const user = await db.user.findUnique({ where: { id: row.userId } });
  if (!user || user.suspended) {
    return fail("user_unavailable", "บัญชีไม่พร้อมใช้งาน", 403);
  }

  await db.mobileAuthBridge.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });

  return ok({
    pending: false as const,
    token: row.token,
    expiresAt: row.expiresAt.toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
  });
}
