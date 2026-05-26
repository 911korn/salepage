import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { ensureLiffReturnParam, resolveLiffStateTarget } from "@/lib/liff-url";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const liffStateRedirect = redirectLiffState(request);
  if (liffStateRedirect) return liffStateRedirect;

  return intlMiddleware(request);
}

function redirectLiffState(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("liff.state");
  if (!state) return null;

  if (!isLiffStateShellPath(request.nextUrl.pathname)) {
    const currentTarget = new URL(request.nextUrl.toString());
    currentTarget.searchParams.delete("liff.state");
    const cleanTarget = ensureLiffReturnParam(currentTarget);
    return NextResponse.redirect(cleanTarget, 307);
  }

  const target = resolveLiffStateTarget(state, request.url);
  if (!target) return null;
  const cleanTarget = ensureLiffReturnParam(target);

  if (
    cleanTarget.pathname.startsWith("/api") ||
    cleanTarget.pathname.startsWith("/_next") ||
    cleanTarget.pathname.startsWith("/_vercel")
  ) {
    return null;
  }

  return NextResponse.redirect(cleanTarget, 307);
}

function isLiffStateShellPath(pathname: string) {
  return pathname === "/" || pathname === "/th" || pathname === "/en";
}

export const config = {
  // Skip intl rewriting for /auth/* (LIFF + OAuth-bridge surfaces that
  // must render at exactly the path LINE Developer Console points at,
  // no `/th/...` locale prefix), plus the standard api / _next / _vercel
  // / static asset exclusions.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
