import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const LIFF_RETURN_PARAM = "sp_liff";

export function proxy(request: NextRequest) {
  const liffStateRedirect = redirectLiffState(request);
  if (liffStateRedirect) return liffStateRedirect;

  const liffRedirect = redirectLineProtectedPage(request);
  if (liffRedirect) return liffRedirect;

  return intlMiddleware(request);
}

function redirectLiffState(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("liff.state");
  if (!state || request.nextUrl.pathname !== "/") return null;
  if (!state.startsWith("/") || state.startsWith("//")) return null;

  const target = new URL(state, request.url);
  return NextResponse.redirect(target, 307);
}

function redirectLineProtectedPage(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_LINE_LIFF_ID?.trim()) return null;
  if (!isLineProtectedPage(request.nextUrl.pathname)) return null;
  if (request.nextUrl.searchParams.get(LIFF_RETURN_PARAM) === "1") return null;
  if (isCrawler(request.headers.get("user-agent") ?? "")) return null;

  const target = new URL(request.url);
  target.searchParams.set(LIFF_RETURN_PARAM, "1");

  const bridge = new URL(lineBridgePath(request.nextUrl.pathname), request.url);
  bridge.searchParams.set("to", `${target.pathname}${target.search}${target.hash}`);
  return NextResponse.redirect(bridge, 307);
}

function isLineProtectedPage(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const { segments } = stripLocale(parts);
  const [first, second, third] = segments;

  if (!first) return false;
  if (first === "o" && second && !third) return true;
  if (first === "line" && second === "orders" && !third) return true;

  return false;
}

function lineBridgePath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const { locale } = stripLocale(parts);
  return locale === "en" ? "/en/line/open" : "/line/open";
}

function stripLocale(parts: string[]) {
  const first = parts[0];
  if (first === "th" || first === "en") {
    return { locale: first, segments: parts.slice(1) };
  }
  return { locale: null, segments: parts };
}

function isCrawler(userAgent: string) {
  if (!userAgent) return false;
  return /bot|crawler|spider|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linepoker|line-poker|preview/i.test(
    userAgent,
  );
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
