import { router } from "expo-router";

/**
 * Defensive replacement for `router.back()`.
 *
 * Why this exists (911korn 2026-05-28 01:35 "ปุ่ม back ทั้งระบบ
 * มันกดไม่ได้เยอะมากและบ่อยมากต้อง Killed app"):
 *
 *  - `router.back()` is a no-op when there's nothing to pop. On many
 *    screens (shop pages, product detail, signin, etc.) the user can
 *    arrive via a fresh deep-link or after a stack reset — the back
 *    button does nothing AND the user thinks the app is frozen.
 *
 *  - Calling `router.back()` on an empty stack in dev throws a
 *    `POP_TO_TOP` warning that can also wedge expo-router's state.
 *
 *  - In modal screens, `router.back()` only dismisses the modal —
 *    if the underlying tab navigator is in an inconsistent state
 *    (e.g. seller-mode switched mid-flow) the user lands on a
 *    half-rendered screen and the next tap silently fails.
 *
 * `safeBack(fallback)` guards every call:
 *  - If the navigator has a previous route → `router.back()`.
 *  - Else → `router.replace(fallback)` so we always reach a known-good
 *    screen instead of a no-op.
 */
export function safeBack(fallback: string = "/(tabs)") {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // canGoBack on a stale navigator can throw — fall through to
    // replace so we never trap the user.
  }
  router.replace(fallback as never);
}
