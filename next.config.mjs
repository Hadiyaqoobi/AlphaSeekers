import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Public R2 host used to serve uploaded assets (images/attachments). Driven by env
// so we don't hardcode the bucket domain; falls back to a documented placeholder.
// Set R2_PUBLIC_BASE_URL to e.g. https://pub-xxxx.r2.dev or your custom CDN domain.
function r2PublicHostname() {
  const raw = process.env.R2_PUBLIC_BASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const r2Hostname = r2PublicHostname();

// Content-Security-Policy: permissive-but-present. Next.js needs 'unsafe-inline'
// for its injected styles and (in some flows) inline scripts; we allow those but
// still constrain framing, object embedding, and base URIs. connect-src permits
// same-origin plus the AI provider/proxy endpoints the app calls from the browser.
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${r2Hostname ? ` https://${r2Hostname}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' https://api.groq.com https://generativelanguage.googleapis.com https://api-inference.huggingface.co${r2Hostname ? ` https://${r2Hostname}` : ""}`,
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
];

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    // Allow the R2 public host as an image source (defense in depth). When
    // R2_PUBLIC_BASE_URL is unset we add no remote pattern, so remote images stay blocked.
    remotePatterns: r2Hostname
      ? [
          {
            protocol: "https",
            hostname: r2Hostname,
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        // Strong security headers on every route.
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/_next/static/css/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/media/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/icon-:size.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
      {
        source: "/team/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
