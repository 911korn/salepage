import "server-only";
import { db } from "@/lib/db";

/**
 * Expo Push Notifications wrapper.
 *
 * Why Expo's service: handles APNs (iOS) + FCM (Android) routing for us, free
 * up to ~600 notifications/sec, deals with throttling. We send via:
 * https://exp.host/--/api/v2/push/send
 *
 * For now we send fire-and-forget — failed sends are logged but never fail
 * the parent action (e.g. an order shouldn't fail to update because Expo is
 * down). Production-grade retry happens via the receipt API which we'll
 * implement when we add a queue (V1.5+).
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushPayload {
  /** Short title (visible on lock screen) — max ~50 chars. */
  title: string;
  /** Body line — max ~200 chars before truncation. */
  body: string;
  /** Data attached for in-app handling (deep link target, order id, etc.). */
  data?: Record<string, unknown>;
  /** "default" for sound, null/undefined for silent. */
  sound?: "default" | null;
  /** iOS badge count override. */
  badge?: number;
  /** Channel ID for Android (configured in mobile app). Defaults to 'default'. */
  channelId?: string;
}

interface ExpoMessage extends PushPayload {
  to: string | string[];
  ttl?: number;
  priority?: "default" | "normal" | "high";
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Send a push notification to a specific user (by `User.id`). No-ops silently
 * if the user has no `expoPushToken` registered.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { expoPushToken: true },
  });
  if (!user?.expoPushToken) return;
  await pushToTokens([user.expoPushToken], payload);
}

/**
 * Send to a raw list of Expo push tokens. Use this when you've already
 * resolved tokens (e.g. fan-out to all followers of a shop).
 */
export async function pushToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<void> {
  const valid = tokens.filter((t) => /^ExponentPushToken\[.+\]$/.test(t));
  if (valid.length === 0) return;

  // Expo accepts up to 100 messages per call; we batch in chunks of 100.
  const chunks: ExpoMessage[][] = [];
  for (let i = 0; i < valid.length; i += 100) {
    const chunk = valid.slice(i, i + 100).map(
      (to): ExpoMessage => ({
        to,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: payload.sound === null ? null : "default",
        badge: payload.badge,
        channelId: payload.channelId ?? "default",
        priority: "high",
      }),
    );
    chunks.push(chunk);
  }

  for (const chunk of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[push] Expo HTTP ${res.status}: ${text.slice(0, 200)}`);
        continue;
      }
      const json = (await res.json().catch(() => null)) as
        | { data?: ExpoTicket[]; errors?: unknown[] }
        | null;
      if (json?.data) {
        for (let i = 0; i < json.data.length; i++) {
          const ticket = json.data[i];
          if (ticket?.status === "error") {
            const errCode = ticket.details?.error;
            console.warn(`[push] ticket error: ${errCode} ${ticket.message}`);
            // Common: "DeviceNotRegistered" → token is dead; clear it from DB
            if (errCode === "DeviceNotRegistered") {
              const dead = chunk[i]!.to as string;
              await db.user
                .updateMany({
                  where: { expoPushToken: dead },
                  data: { expoPushToken: null },
                })
                .catch(() => undefined);
            }
          }
        }
      }
    } catch (err) {
      console.warn("[push] send failed:", err);
    }
  }
}

// ─── User resolution ──────────────────────────────────────────────────────

/**
 * Map an Order's denormalized customer fields back to a `User.id`, since
 * Orders don't FK to User (anonymous checkout supported). Used by every
 * `notifyOrder*` trigger to find which device(s) to push to.
 *
 * Resolution order (most reliable first):
 *   1. LINE Account match — `Account` row where provider="line" and
 *      providerAccountId equals Order.customerLineUserId. Most accurate
 *      because LIFF authenticates against the central @salepage channel.
 *   2. Email match — User.email equals Order.customerEmail. Useful for
 *      magic-link signups that aren't tied to LINE.
 *
 * Returns null if no match (e.g. true-anonymous orders) — every trigger
 * already no-ops on null so this is safe.
 */
export async function resolveCustomerUserId(input: {
  customerLineUserId: string | null;
  customerEmail: string | null;
}): Promise<string | null> {
  if (input.customerLineUserId) {
    const acc = await db.account.findFirst({
      where: { provider: "line", providerAccountId: input.customerLineUserId },
      select: { userId: true },
    });
    if (acc?.userId) return acc.userId;
  }
  if (input.customerEmail) {
    const user = await db.user.findUnique({
      where: { email: input.customerEmail.toLowerCase() },
      select: { id: true },
    });
    if (user?.id) return user.id;
  }
  return null;
}

// ─── Domain triggers ──────────────────────────────────────────────────────

/// Fired by /api/v1/orders/:token/slip when verify succeeds.
/// Customer = User row mapped via Order.customerLineUserId or email match.
export async function notifyOrderPaid(input: {
  customerUserId: string | null;
  orderToken: string;
  shopName: string;
  totalSatang: number;
}): Promise<void> {
  if (!input.customerUserId) return;
  await pushToUser(input.customerUserId, {
    title: `จ่ายเงินสำเร็จ — ${input.shopName}`,
    body: `ยอด ฿${(input.totalSatang / 100).toLocaleString()} ระบบยืนยันแล้ว — รอร้านจัดส่ง`,
    data: { kind: "order.paid", orderToken: input.orderToken },
  });
}

/// Fired by /api/v1/orders/:token/shipment (PATCH).
export async function notifyOrderShipping(input: {
  customerUserId: string | null;
  orderToken: string;
  shopName: string;
  courierName: string;
  trackingNumber: string;
}): Promise<void> {
  if (!input.customerUserId) return;
  await pushToUser(input.customerUserId, {
    title: `จัดส่งแล้ว — ${input.shopName}`,
    body: `${input.courierName} • ${input.trackingNumber}`,
    data: {
      kind: "order.shipping",
      orderToken: input.orderToken,
      trackingNumber: input.trackingNumber,
    },
  });
}

/// Fired by /api/v1/orders/:token/status (PATCH) when status=DELIVERED.
export async function notifyOrderDelivered(input: {
  customerUserId: string | null;
  orderToken: string;
  shopName: string;
}): Promise<void> {
  if (!input.customerUserId) return;
  await pushToUser(input.customerUserId, {
    title: `จัดส่งสำเร็จ — ${input.shopName}`,
    body: "ของถึงมือคุณแล้ว — ฝากรีวิวร้านได้เลย",
    data: { kind: "order.delivered", orderToken: input.orderToken },
  });
}

/// V1.5 Protected Pay: fired whenever an EscrowHold transitions to RELEASED
/// (buyer-confirm, 72h cron, admin manual, or dispute resolved-no-action).
/// Goes to the shop owner so they see the money is theirs.
export async function notifyEscrowReleasedToShop(input: {
  shopOwnerUserId: string;
  orderToken: string;
  amountSatang: number;
  reason: "buyer_confirmed" | "auto_release_72h" | "admin_manual" | "dispute_no_action";
}): Promise<void> {
  const reasonLabel =
    input.reason === "buyer_confirmed"
      ? "ลูกค้ายืนยันรับสินค้า"
      : input.reason === "auto_release_72h"
        ? "ครบกำหนด 72 ชั่วโมง"
        : input.reason === "dispute_no_action"
          ? "ข้อพิพาทยุติแล้ว"
          : "แอดมินอนุมัติ";
  const baht = (input.amountSatang / 100).toLocaleString("th-TH");
  await pushToUser(input.shopOwnerUserId, {
    title: `💰 รับเงินจาก Protected Pay ${baht}฿`,
    body: reasonLabel,
    data: {
      kind: "escrow.released",
      orderToken: input.orderToken,
      reason: input.reason,
    },
  });
}

/// V1.5 Protected Pay: fired when an escrow is REFUNDED back to the buyer
/// (dispute decision, admin manual, or seller cancel).
export async function notifyEscrowRefundedToBuyer(input: {
  customerUserId: string | null;
  orderToken: string;
  amountSatang: number;
  reason: "admin_refund" | "dispute_refund";
}): Promise<void> {
  if (!input.customerUserId) return;
  const baht = (input.amountSatang / 100).toLocaleString("th-TH");
  await pushToUser(input.customerUserId, {
    title: `↩️ คืนเงิน ${baht}฿`,
    body:
      input.reason === "dispute_refund"
        ? "ข้อพิพาทตัดสินคืนเงิน — เงินจะกลับเข้าบัญชี 1–3 วันทำการ"
        : "ออเดอร์ถูกยกเลิก — เงินจะกลับเข้าบัญชี 1–3 วันทำการ",
    data: {
      kind: "escrow.refunded",
      orderToken: input.orderToken,
      reason: input.reason,
    },
  });
}
