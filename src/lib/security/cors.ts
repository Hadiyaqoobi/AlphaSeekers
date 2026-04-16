/**
 * CORS support for public-facing API routes.
 *
 * Browsers enforce same-origin by default; cross-origin fetches from a
 * companion app, embedded widget, or partner site need explicit CORS
 * headers from us. We allowlist origins via env (comma-separated) and
 * echo back only matching values — never `*` plus credentials, which
 * the spec forbids.
 *
 * Usage in a route file:
 *
 *   import { withCors, corsPreflight } from "@/lib/security/cors";
 *
 *   export async function GET(request: Request) {
 *     const data = await loadStuff();
 *     return withCors(Response.json({ data }), request);
 *   }
 *
 *   export async function OPTIONS(request: Request) {
 *     return corsPreflight(request);
 *   }
 *
 * Env: CORS_ALLOWED_ORIGINS="https://app.alphaseekers.com,https://www.alphaseekers.com"
 *
 * If the env var is unset, no `Access-Control-Allow-Origin` is emitted —
 * cross-origin requests are blocked by default (safe).
 */

const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowed(origin: string | null): origin is string {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes("*")) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function buildHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (isAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/**
 * Wrap a Response with CORS headers based on the request's Origin.
 * If the origin isn't allowlisted, no Access-Control-Allow-Origin is set
 * (the browser will then block the response, which is the desired default).
 */
export function withCors(response: Response, request: Request): Response {
  const origin = request.headers.get("origin");
  for (const [key, value] of Object.entries(buildHeaders(origin))) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Build a 204 preflight response for OPTIONS requests.
 */
export function corsPreflight(request: Request): Response {
  const origin = request.headers.get("origin");
  return new Response(null, { status: 204, headers: buildHeaders(origin) });
}
