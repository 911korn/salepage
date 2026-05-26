import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import { getEnv } from "@/lib/env";

/**
 * LINE OAuth 2.1 PKCE flow for native (no client secret).
 *
 * Returns the LINE id_token, which the caller passes to
 * `POST /api/v1/auth/line-mobile` to receive a SalePage JWT.
 *
 * Why PKCE without client secret:
 *  - Public mobile clients can't keep secrets — anyone can decompile the .ipa.
 *  - LINE Login channel for "Native app" is provisioned without a secret;
 *    PKCE prevents auth-code interception attacks instead.
 *
 * Required env (set on web side; passed to mobile via app.config.ts > extra):
 *  - LINE_LOGIN_CHANNEL_ID  → exposed to mobile as EXPO_PUBLIC_LINE_LOGIN_CHANNEL_ID
 *  - Redirect URI must be registered in LINE Developers as `salepage://auth/line`
 */

const LINE_AUTH_ENDPOINT = "https://access.line.me/oauth2/v2.1/authorize";
const LINE_TOKEN_ENDPOINT = "https://api.line.me/oauth2/v2.1/token";

export interface LineLoginResult {
  idToken: string;
  accessToken?: string;
}

export async function loginWithLine(): Promise<LineLoginResult> {
  const env = getEnv();
  if (!env.lineLoginChannelId) {
    throw new Error(
      "EXPO_PUBLIC_LINE_LOGIN_CHANNEL_ID is not set. Configure in mobile/.env.local",
    );
  }

  // `salepage://auth/line` — must match LINE Developers Console exactly.
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "salepage",
    path: "auth/line",
  });

  // PKCE: generate verifier + challenge. expo-crypto only exposes BASE64, so
  // we hand-roll the URL-safe variant (RFC 7636 §4.2) — replace + / =.
  const codeVerifier = generateRandomString(64);
  const codeChallengeBase64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  const codeChallenge = codeChallengeBase64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // CSRF: random state + nonce (id_token replay protection).
  const state = generateRandomString(16);
  const nonce = generateRandomString(16);

  const request = new AuthSession.AuthRequest({
    clientId: env.lineLoginChannelId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ["profile", "openid", "email"],
    state,
    extraParams: { nonce },
    usePKCE: true,
    codeChallenge,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
  });

  const result = await request.promptAsync({ authorizationEndpoint: LINE_AUTH_ENDPOINT });

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new LineLoginCancelledError();
  }
  if (result.type === "error") {
    throw new Error(`LINE login error: ${result.error?.message ?? "unknown"}`);
  }
  if (result.type !== "success" || !result.params.code) {
    throw new Error("LINE login: no auth code returned");
  }
  if (result.params.state !== state) {
    throw new Error("LINE login: state mismatch (possible CSRF)");
  }

  // Exchange code → tokens. LINE accepts public-client PKCE without secret.
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: String(result.params.code),
    redirect_uri: redirectUri,
    client_id: env.lineLoginChannelId,
    code_verifier: codeVerifier,
  });

  const res = await fetch(LINE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    id_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.id_token) {
    throw new Error(json.error_description ?? json.error ?? "Token exchange failed");
  }

  return {
    idToken: json.id_token,
    accessToken: json.access_token,
  };
}

export class LineLoginCancelledError extends Error {
  constructor() {
    super("LINE login cancelled by user");
    this.name = "LineLoginCancelledError";
  }
}

function generateRandomString(byteLength: number): string {
  // expo-crypto provides cryptographic random bytes on iOS/Android.
  const bytes = Crypto.getRandomBytes(byteLength);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  // RFC 4648 §5 — URL-safe base64 without padding.
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  // btoa is available in Hermes/JSCore RN.
  // eslint-disable-next-line no-undef
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
