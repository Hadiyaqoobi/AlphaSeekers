import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
    // Integration tests share a single Postgres database and the Prisma client
    // singleton, so their table cleanups must not race across files. Run test
    // files serially (unit tests are unaffected; the cost is negligible).
    fileParallelism: false,
  },
});
