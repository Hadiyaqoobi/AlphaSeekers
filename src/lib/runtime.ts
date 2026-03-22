export type AlphaSeekersMode = "demo" | "production";

function normalizeMode(raw: string | undefined | null): AlphaSeekersMode {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "production" || value === "prod") {
    return "production";
  }

  // Default to demo to preserve local/dev UX even when NODE_ENV=production (e.g. `next start`).
  return "demo";
}

function parseBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export const runtime = (() => {
  const mode = normalizeMode(process.env.ALPHASEEKERS_MODE);

  return {
    mode,
    allowDemoAuth: parseBooleanEnv("ALPHASEEKERS_ALLOW_DEMO_AUTH", mode !== "production"),
    allowAutoSeed: parseBooleanEnv("ALPHASEEKERS_AUTO_SEED", mode !== "production"),
    allowMockMeetLinks: parseBooleanEnv("ALPHASEEKERS_ALLOW_MOCK_MEET_LINKS", mode !== "production"),
    allowDbFallback: parseBooleanEnv("ALPHASEEKERS_ALLOW_DB_FALLBACK", mode !== "production"),
    publicLandingStats:
      (process.env.ALPHASEEKERS_PUBLIC_STATS ?? "static").trim().toLowerCase() === "dynamic" ? ("dynamic" as const) : ("static" as const),
  };
})();

let warned = false;

export function warnIfInsecureProductionConfig() {
  if (warned) return;
  warned = true;

  const runningProdBuild = process.env.NODE_ENV === "production";

  if (runningProdBuild && runtime.mode !== "production") {
    // This is intentionally loud: deploys should opt into production mode explicitly.
    // Local `next start` often runs with NODE_ENV=production, so we only warn (not throw).
    console.warn(
      "[AlphaSeekers] WARNING: NODE_ENV=production but ALPHASEEKERS_MODE is not 'production'. Running in demo mode.",
    );
  }

  if (runtime.mode === "production") {
    const insecure = [
      runtime.allowDemoAuth ? "ALPHASEEKERS_ALLOW_DEMO_AUTH" : null,
      runtime.allowAutoSeed ? "ALPHASEEKERS_AUTO_SEED" : null,
      runtime.allowMockMeetLinks ? "ALPHASEEKERS_ALLOW_MOCK_MEET_LINKS" : null,
      runtime.allowDbFallback ? "ALPHASEEKERS_ALLOW_DB_FALLBACK" : null,
    ].filter(Boolean);

    if (insecure.length > 0) {
      console.error(
        `[AlphaSeekers] SECURITY WARNING: production mode enabled but insecure demo toggles are on: ${insecure.join(
          ", ",
        )}.`,
      );
    }
  }
}

