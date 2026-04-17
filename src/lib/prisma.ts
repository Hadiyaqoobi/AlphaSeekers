import { PrismaClient } from "@prisma/client";

// Temporary diagnostic — prints DATABASE_URL shape to Render logs (no credentials)
const dbUrl = process.env.DATABASE_URL ?? "";
console.log("[DB DIAG] DATABASE_URL length:", dbUrl.length,
  "| first 20 chars:", JSON.stringify(dbUrl.slice(0, 20)),
  "| last 15 chars:", JSON.stringify(dbUrl.slice(-15)),
  "| starts with postgresql://:", dbUrl.startsWith("postgresql://"));

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
