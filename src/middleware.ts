import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all paths EXCEPT API, _next, favicon, icon, public assets
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
