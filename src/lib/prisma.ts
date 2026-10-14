import { PrismaClient } from "@prisma/client";

import { invalidatePublicCache, type PublicScope } from "@/lib/platform/public-cache";

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

/**
 * Which public-page cache scopes each model feeds (see
 * `src/lib/platform/public-cache.ts`). A write to one of these models marks the
 * scopes stale, so an admin's change is visible on the public site at once.
 *
 * `User` is deliberately absent even though a teacher's name appears on the
 * landing page: users are written constantly (every sign-up), and a renamed
 * teacher is picked up by the hourly refresh anyway.
 */
const PUBLIC_SCOPES_BY_MODEL: Record<string, PublicScope[]> = {
  SiteSettings: ["settings"],
  Class: ["landing"],
  Enrollment: ["landing"],
  Webinar: ["webinars", "landing"],
  Opportunity: ["opportunities", "landing"],
  LibraryResource: ["library"],
  StudentPost: ["stories"],
};

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

/**
 * Invalidate the public cache from ONE place rather than at every call site.
 * Writes to these models happen in the stores, in API routes and inside
 * transactions; a hook on the client catches all of them, including ones added
 * later. Reads pass straight through.
 *
 * Not covered: rows removed by a database-level cascade, and raw SQL. Both are
 * picked up by the hourly refresh.
 */
function withPublicCacheInvalidation(client: PrismaClient): PrismaClient {
  const extended = client.$extends({
    name: "public-cache-invalidation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scopes = WRITE_OPERATIONS.has(operation)
            ? PUBLIC_SCOPES_BY_MODEL[model]
            : undefined;

          if (!scopes) return query(args);

          try {
            return await query(args);
          } finally {
            // Also on failure: a statement that threw may still have changed
            // rows inside a transaction that goes on to commit.
            for (const scope of scopes) invalidatePublicCache(scope);
          }
        },
      },
    },
  });

  // The extension only observes queries; it adds no models, fields or methods.
  // Keeping the plain PrismaClient type means nothing else in the codebase has
  // to know the client is extended.
  return extended as unknown as PrismaClient;
}

export const prisma =
  global.prisma ||
  withPublicCacheInvalidation(
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
    }),
  );

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
