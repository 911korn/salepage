import { Share, type ShareContent, type ShareOptions } from "react-native";
import { getEnv } from "./env";

/**
 * Native share sheet wrapper. Falls back to silent no-op on share failure
 * (user cancels, or the platform fails) because cancellation isn't an error
 * the UI should surface.
 *
 * Always builds the URL on top of `webBaseUrl` (public domain) so links are
 * shareable even when the device is pointing at a LAN dev API.
 *
 * If `referrerUserId` is provided, we tack on `?ref=<id>` so the shared link
 * carries V1.5 affiliate attribution. The deep-link handler in `_layout.tsx`
 * captures it on the receiving side via `saveReferrer()`.
 */
export async function shareUrl(input: {
  /** Path beginning with `/` — e.g. `/s/lemonshop` or `/s/lemonshop/iced-tea`. */
  path: string;
  /** Title shown on Android share sheet. */
  title: string;
  /** Optional message that prefixes the URL on iOS (Android shows separately). */
  message?: string;
  /** Optional affiliate ref to append as `?ref=` query param. */
  referrerUserId?: string;
}): Promise<void> {
  const { webBaseUrl } = getEnv();
  const basePath = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const refSuffix = input.referrerUserId
    ? `${basePath.includes("?") ? "&" : "?"}ref=${encodeURIComponent(input.referrerUserId)}`
    : "";
  const url = `${webBaseUrl}${basePath}${refSuffix}`;

  // Only pass `message` (URL embedded), never both `message` and `url`.
  // iOS exposes both fields independently to the share target, and apps
  // like Telegram + LINE serialize each as a separate text chunk —
  // resulting in the URL appearing twice in the sent message (911korn
  // 2026-05-27 screenshot). Recipients still get an OG preview because
  // Telegram/LINE/iMessage detect URLs inside text.
  const messageWithUrl = input.message ? `${input.message}\n${url}` : url;
  const content: ShareContent = { title: input.title, message: messageWithUrl };

  const options: ShareOptions = {
    dialogTitle: input.title,
    subject: input.title,
  };

  try {
    await Share.share(content, options);
  } catch {
    // Swallowed: usually user-cancellation or rare platform error.
  }
}

/** Convenience helpers for the two surfaces that share today. */
export const shareShop = (slug: string, name: string, referrerUserId?: string) =>
  shareUrl({
    path: `/s/${slug}`,
    title: name,
    message: `เจอร้าน ${name} บน SalePage มาดูกัน`,
    referrerUserId,
  });

export const shareProduct = (input: {
  shopSlug: string;
  productSlug: string;
  productName: string;
  priceBaht: number;
  referrerUserId?: string;
}) =>
  shareUrl({
    path: `/s/${input.shopSlug}/${input.productSlug}`,
    title: input.productName,
    message: `${input.productName} • ฿${input.priceBaht.toLocaleString()} บน SalePage`,
    referrerUserId: input.referrerUserId,
  });
