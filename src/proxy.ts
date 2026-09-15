// Next 16 renamed the `middleware` file convention to `proxy`. The next-intl
// import path is unchanged — only the file name and the exported symbol moved.
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

