import "server-only";
import { db } from "@/lib/db";
import { getPlatformLineChannelAccessToken } from "@/lib/line";

/**
 * LINE Messaging API push helpers — send messages from the @salepage
 * Official Account to a user who has linked their LINE account via the
 * LIFF login flow.
 *
 * 911korn 2026-05-26: "Login with LINE บังคับให้ไป LINE LIFF ของ
 * @salepage ไปเลย ... ได้ผลประโยชน์เวลาแจ้งเตือนต่างๆ ด้วยเลย" — pairing
 * login with friend-add gives us a push channel for order updates,
 * dispute notifications, and shop replies that doesn't depend on the
 * user keeping the SalePage app foreground.
 *
 * Two helpers:
 *   - `pushToLineUserId`   — direct, when caller already has the LINE id
 *   - `pushToUser`         — looks up `lineUserId` on the User row
 *
 * Both are fire-and-forget from the caller's perspective: failures are
 * logged but never thrown, because LINE delivery should never block an
 * order create / refund / etc.
 *
 * LINE Messaging API quota for free tier (as of 2026): 200 messages/mo
 * for the destination. Heavy paths should batch + check quota; the
 * helpers below are for low-volume transactional push.
 */

const PUSH_URL = "https://api.line.me/v2/bot/message/push";

interface TextPayload {
  type: "text";
  text: string;
}
interface FlexPayload {
  type: "flex";
  altText: string;
  contents: unknown;
}
type Message = TextPayload | FlexPayload;

/**
 * Send a single message to the given LINE userId.
 * Returns true on HTTP 200 from LINE, false otherwise.
 */
export async function pushToLineUserId(
  lineUserId: string,
  messages: Message[],
): Promise<boolean> {
  const token = getPlatformLineChannelAccessToken();
  if (!token) {
    console.warn("[line-push] SALEPAGE_LINE_CHANNEL_ACCESS_TOKEN not set — skipping");
    return false;
  }
  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: lineUserId,
        messages,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(
        `[line-push] push to ${lineUserId} failed: ${res.status} ${body.slice(0, 300)}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[line-push] push to ${lineUserId} threw:`, err);
    return false;
  }
}

/**
 * Convenience: look up the User's lineUserId then push. No-op if the
 * user hasn't linked LINE.
 */
export async function pushToUser(
  userId: string,
  messages: Message[],
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { lineUserId: true },
  });
  if (!user?.lineUserId) return false;
  return pushToLineUserId(user.lineUserId, messages);
}

/**
 * Simple text-only convenience for short transactional notifications.
 */
export async function pushTextToUser(
  userId: string,
  text: string,
): Promise<boolean> {
  return pushToUser(userId, [{ type: "text", text }]);
}
