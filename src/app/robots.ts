import type { MetadataRoute } from "next";

/**
 * /robots.txt
 *
 * Keeps well-behaved crawlers off pages that are useless in a search index and
 * that can cost a database wake (Neon bills by the hours its compute is awake;
 * see docs/adr/0008-only-wake-the-database-when-something-is-due.md):
 *
 *   /<locale>/join/<id>      per-class sign-up form, linked from the landing page
 *   /<locale>/classes/...    signed-in area; a crawler only gets redirected
 *   /<locale>/stories/write  the story editor
 *   /api/                    machine endpoints
 *
 * Everything else, including the landing page and Student Voices, stays
 * crawlable. This is advice, not enforcement: link previewers such as WhatsApp's
 * ignore robots.txt, which is why the join page also reads through the public
 * cache.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/*/join/", "/*/classes/", "/*/stories/write", "/api/"],
      },
    ],
  };
}
