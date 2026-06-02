import { ok } from "@/lib/api";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * Lightweight "am I signed in?" probe for statically-prerendered public
 * pages (the marketing homepage Navbar) that must NOT call `auth()` at
 * render time — doing so forces the whole page dynamic and invokes a
 * function per bot/crawler/repeat hit (this was the salepage `/[locale]`
 * Delivery-Network cost driver: ~694K req/day, 0% cached). The Navbar
 * fetches this client-side instead; bots/crawlers don't run JS so they
 * never reach it and keep getting the cached static shell. Per-user →
 * never CDN-cached.
 */
export async function GET() {
  const session = await auth();
  return ok({ signedIn: Boolean(session?.user?.id) }, { headers: NO_STORE });
}
