import "server-only";
import { SignJWT, importPKCS8 } from "jose";

/**
 * Generate a "Sign in with Apple" client secret (ES256 JWT).
 *
 * Apple requires the OAuth `client_secret` to be a signed JWT bound to the
 * caller's Team ID + Services ID + Key ID. The JWT must be ≤ 6 months
 * lifetime — we generate one valid for 30 days and re-mint on demand so we
 * never have to ship a manual rotation playbook.
 *
 * Required env (set on Vercel):
 *  - AUTH_APPLE_TEAM_ID — your 10-char Apple Team ID (e.g. MR3FF57WDB)
 *  - AUTH_APPLE_KEY_ID  — the Key ID from the "Sign in with Apple" key
 *  - AUTH_APPLE_PRIVATE_KEY — the full PEM contents of the .p8 file
 *      (literal `-----BEGIN PRIVATE KEY-----\n...` — newlines as `\n` in env)
 *  - AUTH_APPLE_ID       — Services ID (the OAuth client_id), e.g. live.salepage.web
 *
 * Returns null when env is incomplete so auth.ts can fall back to a static
 * AUTH_APPLE_SECRET (the `npx auth add apple` flow) if the operator
 * prefers that route.
 */
const CACHE_TTL_MS = 25 * 24 * 60 * 60 * 1000; // 25 days
let cached: { value: string; expiresAt: number } | null = null;

export async function getAppleClientSecret(): Promise<string | null> {
  const teamId = process.env.AUTH_APPLE_TEAM_ID;
  const keyId = process.env.AUTH_APPLE_KEY_ID;
  const privateKeyPem = process.env.AUTH_APPLE_PRIVATE_KEY;
  const servicesId = process.env.AUTH_APPLE_ID;
  if (!teamId || !keyId || !privateKeyPem || !servicesId) return null;

  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pkcs8 = privateKeyPem.replace(/\\n/g, "\n");
  const key = await importPKCS8(pkcs8, "ES256");
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 30 * 24 * 60 * 60; // 30 days — well under Apple's 6 month max

  const value = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuedAt(now)
    .setIssuer(teamId)
    .setSubject(servicesId)
    .setAudience("https://appleid.apple.com")
    .setExpirationTime(now + expiresIn)
    .sign(key);

  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
