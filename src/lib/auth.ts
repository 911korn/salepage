import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";

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
