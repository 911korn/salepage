import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Line from "next-auth/providers/line";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";
import { getAppleClientSecret } from "@/lib/apple-client-secret";

const providers: NextAuthConfig["providers"] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      // Always show Google's account chooser, even when a Google session
      // is active in the browser. Otherwise after logging out of SalePage
      // and tapping "Sign in with Google" the user gets bounced straight
      // back in as the previous email — no way to switch accounts on the
      // same device (911korn 2026-05-27: "Logout แล้ว Login With google
      // อีกครั้งมันจะไม่ให้เลือกเมล · มันจะ Auto เข้าเมลเดิมเลย").
      authorization: {
        params: { prompt: "select_account" },
      },
    }),
  );
}

// Sign in with Apple — required parity with the iOS app per App Store
// Guideline 4.8 (already met on mobile via expo-apple-authentication; the
// 911korn 2026-05-27 directive "หน้าเว็บต้องมี Login With apple ด้วย"
// extends parity to the web). The provider is gated on env so a partial
// configuration (e.g. AUTH_APPLE_ID set but no private key yet) keeps the
// existing Google + email flows working.
const hasAppleConfig = Boolean(
  process.env.AUTH_APPLE_ID &&
    (process.env.AUTH_APPLE_SECRET ||
      (process.env.AUTH_APPLE_TEAM_ID &&
        process.env.AUTH_APPLE_KEY_ID &&
        process.env.AUTH_APPLE_PRIVATE_KEY)),
);
if (hasAppleConfig) {
  // Static secret takes precedence when set (operator may have run
  // `npx auth add apple` to pre-generate a 6-month JWT). Otherwise mint
  // a fresh ES256 JWT from the .p8 at module load and cache it.
  // Top-level await is fine here — auth.ts is a server-only module.
  const appleSecret =
    process.env.AUTH_APPLE_SECRET ?? (await getAppleClientSecret()) ?? "";
  if (appleSecret) {
    providers.push(
      Apple({
        clientId: process.env.AUTH_APPLE_ID!,
        clientSecret: appleSecret,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }
}

// LINE Login — critical for Thai buyers who arrive via LINE chat links.
// Google blocks OAuth in LINE's in-app browser; sign-in with LINE lets
// the buyer keep their existing LINE session and not switch browsers
// (911korn 2026-05-27 IMG_5547 "Login with google ติดอยู่ใน Modal").
//
// Uses the same LINE Login channel as verifyPlatformLineIdToken (mobile
// LIFF flow) — one channel, two consumers. The OIDC `email` scope is
// requested so we can fall back to dedupe by email when LINE doesn't
// release a verified one (rare).
const hasLineConfig = Boolean(
  process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET,
);
if (hasLineConfig) {
  providers.push(
    Line({
      clientId: process.env.LINE_LOGIN_CHANNEL_ID!,
      clientSecret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (process.env.AUTH_RESEND_KEY) {
  providers.push(
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM ?? "SalePage <noreply@salepage.in.th>",
    }),
  );
}

export const authConfig: NextAuthConfig = {
  // Cast: Prisma 7's deep generic types defeat the adapter signature inference.
  // The runtime contract is intact; this is purely a type-checker workaround.
  adapter: PrismaAdapter(db as never),
  providers,
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
  },
  session: {
    strategy: "database",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}
