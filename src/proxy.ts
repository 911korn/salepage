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
  if (!state || request.nextUrl.pathname !== "/") return null;
  if (!state.startsWith("/") || state.startsWith("//")) return null;

  const target = new URL(state, request.url);
  return NextResponse.redirect(target, 307);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
