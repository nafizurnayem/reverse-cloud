import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // API endpoints, Next.js assets, and public files keep their original URLs.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
