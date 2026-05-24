import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const liffStateRedirect = redirectLiffState(request);
  if (liffStateRedirect) return liffStateRedirect;

  return intlMiddleware(request);
}

function redirectLiffState(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("liff.state");
  if (!state) return null;

  const target = resolveLiffStateTarget(state, request.url);
  if (!target) return null;
  if (!target.searchParams.has("sp_liff")) {
    target.searchParams.set("sp_liff", "1");
  }
  return NextResponse.redirect(target, 307);
}

function resolveLiffStateTarget(state: string, requestUrl: string) {
  const base = new URL(requestUrl);
  let target: URL;

  try {
    if (state.startsWith("/") && !state.startsWith("//")) {
      target = new URL(state, base);
    } else if (/^https?:\/\//i.test(state)) {
      target = new URL(state);
      if (target.origin !== base.origin) return null;
    } else {
      return null;
    }
  } catch {
    return null;
  }

  if (
    target.pathname.startsWith("/api") ||
    target.pathname.startsWith("/_next") ||
    target.pathname.startsWith("/_vercel")
  ) {
    return null;
  }

  return target;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
