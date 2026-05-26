import { randomBytes } from "node:crypto";

/**
 * Provider-agnostic RTC token generator for `LiveBroadcast`.
 *
 * V2.0 ships a stub that returns opaque random tokens — enough to wire
 * the lifecycle and the watch screen. Once we pick a provider (Agora /
 * 100ms / LiveKit / Cloudflare Realtime), we swap this single file and
 * the rest of the stack stays untouched.
 *
 * The contract:
 *
 *   - `provisionBroadcast(broadcastId)` is called once when a SCHEDULED
 *     row is created. It returns a publish token (seller-only, kept on
 *     the server until the seller calls `/start`) and a subscribe token
 *     (handed to viewers who connect to /watch).
 *
 *   - `revokeBroadcast(broadcastId)` is called when a row transitions to
 *     ENDED. Real providers expire the channel on their side; the stub
 *     no-ops since nothing's listening.
 */
export interface RtcCredentials {
  rtcProvider: string;
  rtcChannelId: string;
  rtcPublishToken: string;
  rtcSubscribeToken: string;
  /**
   * For HTTP/HLS providers, the read URL viewers can pipe into a video
   * element. Leave null for WebRTC providers — the mobile SDK derives
   * playback from the channelId + subscribeToken.
   */
  playbackUrl: string | null;
}

const STUB_PROVIDER = "stub";

export function provisionBroadcast(broadcastId: string): RtcCredentials {
  // We deterministically derive `rtcChannelId` from broadcastId so devs can
  // recognise the relationship in logs. Tokens are random + opaque.
  const channelId = `live-${broadcastId.slice(0, 12)}`;
  return {
    rtcProvider: STUB_PROVIDER,
    rtcChannelId: channelId,
    rtcPublishToken: randomBytes(24).toString("hex"),
    rtcSubscribeToken: randomBytes(24).toString("hex"),
    playbackUrl: null,
  };
}

/**
 * Revoke active credentials. For the stub it's a no-op; real providers
 * call out to the platform API to invalidate the channel.
 */
export async function revokeBroadcast(_broadcastId: string): Promise<void> {
  // no-op stub
}
