import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Build the datasource URL for Prisma.
 *
 * IMPORTANT: In production, DATABASE_URL MUST point at the Neon POOLED connection
 * string (the host contains "-pooler", e.g.
 *   postgresql://user:pass@ep-xyz-pooler.us-east-2.aws.neon.tech/db?sslmode=require
 * ). Serverless/edge-style deployments open many short-lived connections; without
 * PgBouncer pooling and a bounded connection_limit, Neon's direct (non-pooled)
 * endpoint exhausts its connection cap and the app starts throwing
 * "too many connections" errors under load.
 *
 * We also allow DATABASE_CONNECTION_LIMIT to append ?connection_limit=<n> to the
 * URL when the caller hasn't already set it. For PgBouncer/pooled connections a
 * small per-instance limit (e.g. 5) is recommended.
 */
function buildDatabaseUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) {
    return undefined;
  }

  const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT;
  if (!connectionLimit) {
    return base;
  }

  // Only append if the caller hasn't already specified connection_limit.
  if (/[?&]connection_limit=/.test(base)) {
    return base;
  }

  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}connection_limit=${encodeURIComponent(connectionLimit)}`;
}

const databaseUrl = buildDatabaseUrl();

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(databaseUrl
      ? {
          datasources: {
            db: {
              url: databaseUrl,
            },
          },
        }
      : {}),
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
