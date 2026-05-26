import { z } from "zod";
import { ok, parseJson } from "@/lib/api";
import { db } from "@/lib/db";
import { resolveSession } from "@/lib/api-auth";

/**
 * Manage the current user's Expo push notification token.
 *
 * - POST: register / update (mobile calls on auth + every cold-start)
 * - DELETE: clear (mobile calls on logout)
 *
 * Multi-device (multiple tokens per user) is a V1 task — current model stores
 * a single token at User.expoPushToken to keep the migration shallow.
 */
const Body = z.object({
  // Expo push token format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  token: z
    .string()
    .min(20)
    .max(120)
    .regex(/^ExponentPushToken\[.+\]$/, "Invalid Expo push token format"),
});

export async function POST(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  const parsed = await parseJson(request, Body);
  if (!parsed.ok) return parsed.response;

  await db.user.update({
    where: { id: session.user.id },
    data: { expoPushToken: parsed.data.token },
  });
  return ok({ registered: true });
}

export async function DELETE(request: Request) {
  const session = await resolveSession(request);
  if (!session.ok) return session.response;

  await db.user.update({
    where: { id: session.user.id },
    data: { expoPushToken: null },
  });
  return ok({ cleared: true });
}
