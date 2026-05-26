import * as Crypto from "expo-crypto";
import * as AuthSession from "expo-auth-session";
import { getEnv } from "@/lib/env";

/**
 * Google OAuth 2.0 PKCE flow for the mobile app.
 *
 * We deliberately mirror the LINE login flow at `mobile/src/lib/line-login.ts`
 * instead of using `expo-auth-session/providers/google` because we want full
 * control over the redirect URI + token exchange. This also keeps both
 * providers symmetrical — same helper functions, same `id_token → JWT`
 * exchange against the SalePage backend.
 *
 * 911korn's directive: same OAuth credentials as the web's Auth.js Google
 * provider (`AUTH_GOOGLE_ID`). Reusing the web client_id means buyers signing
 * in on mobile end up on the SAME `User` row as their existing salepage.in.th
 * account — Auth.js + this endpoint both find/create by lower-cased email.
 *
 * Required env:
 *   - EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID — the AUTH_GOOGLE_ID value from web.
 *     For Expo Go dev, this needs `https://auth.expo.io/@<owner>/<slug>` added
 *     as an authorized redirect URI in Google Cloud Console.
 *     For EAS production builds with a custom URI scheme, the same OAuth
 *     client must allow `salepage://auth/google`.
 */

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface GoogleLoginResult {
  idToken: string;
  accessToken?: string;
}

export class GoogleLoginCancelledError extends Error {
  constructor() {
    super("Google login cancelled by user");
    this.name = "GoogleLoginCancelledError";
  }
}

export async function loginWithGoogle(): Promise<GoogleLoginResult> {
  const env = getEnv();
  if (!env.googleOAuthClientId) {
    throw new Error(
      "EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID is not set. Configure in mobile/.env.local with the same value as the web's AUTH_GOOGLE_ID.",
    );
  }

  // `salepage://auth/google` — must be registered in the Google Cloud OAuth
  // client. For Expo Go dev, the redirect goes through Expo's auth proxy
  // instead, which uses `https://auth.expo.io/@<owner>/<slug>`.
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "salepage",
    path: "auth/google",
  });

  // PKCE: SHA-256 challenge derived from the verifier. expo-crypto only ships
  // BASE64 (no BASE64URL), so we hand-roll the URL-safe transform.
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

  const state = generateRandomString(16);
  const nonce = generateRandomString(16);

  const request = new AuthSession.AuthRequest({
    clientId: env.googleOAuthClientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ["openid", "email", "profile"],
    state,
    extraParams: { nonce, access_type: "offline" },
    usePKCE: true,
    codeChallenge,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
  });

  const result = await request.promptAsync({
    authorizationEndpoint: GOOGLE_AUTH_ENDPOINT,
  });

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new GoogleLoginCancelledError();
  }
  if (result.type === "error") {
    throw new Error(`Google login error: ${result.error?.message ?? "unknown"}`);
  }
  if (result.type !== "success" || !result.params.code) {
    throw new Error("Google login: no auth code returned");
  }
  if (result.params.state !== state) {
    throw new Error("Google login: state mismatch (possible CSRF)");
  }

  // Exchange auth code → id_token. Google accepts public-client PKCE without
  // a client secret for the iOS / Android client types — the same is true
  // for the "Web application" client type when paired with PKCE.
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: String(result.params.code),
    redirect_uri: redirectUri,
    client_id: env.googleOAuthClientId,
    code_verifier: codeVerifier,
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
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

function generateRandomString(byteLength: number): string {
  const bytes = Crypto.getRandomBytes(byteLength);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  // eslint-disable-next-line no-undef
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
