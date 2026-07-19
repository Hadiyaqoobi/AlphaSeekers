export type AlphaSeekersMode = "demo" | "production";

function normalizeMode(raw: string | undefined | null): AlphaSeekersMode {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "production" || value === "prod") {
    return "production";
  }
  if (value === "demo") {
    return "demo";
  }

  // When ALPHASEEKERS_MODE is unset/unrecognized, derive a SAFE default from NODE_ENV.
  // A production build must never silently fall into demo mode (which would enable demo
  // auth, auto-seeding, mock Meet links, and DB→memory fallback). Only non-production
  // environments default to demo to preserve local/dev UX.
  if (process.env.NODE_ENV === "production") {
    return "production";
  }
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
  const knowinglyDemo = process.env.ALPHASEEKERS_I_KNOW_THIS_IS_DEMO === "true";

  if (runningProdBuild && runtime.mode !== "production") {
    // With the NODE_ENV-derived default, a prod build only lands here when the operator
    // explicitly set ALPHASEEKERS_MODE=demo. Stay loud so it never goes unnoticed.
    console.warn(
      "[AlphaSeekers] WARNING: NODE_ENV=production but ALPHASEEKERS_MODE is not 'production'. Running in demo mode.",
    );
  }

  const insecure = [
    runtime.allowDemoAuth ? "ALPHASEEKERS_ALLOW_DEMO_AUTH" : null,
    runtime.allowAutoSeed ? "ALPHASEEKERS_AUTO_SEED" : null,
    runtime.allowMockMeetLinks ? "ALPHASEEKERS_ALLOW_MOCK_MEET_LINKS" : null,
    runtime.allowDbFallback ? "ALPHASEEKERS_ALLOW_DB_FALLBACK" : null,
  ].filter(Boolean);

  if (runningProdBuild && insecure.length > 0 && !knowinglyDemo) {
    // Fail fast at boot: a production build must never run with insecure demo toggles on.
    // Operators who genuinely want a demo on a prod build must set
    // ALPHASEEKERS_I_KNOW_THIS_IS_DEMO=true to acknowledge the risk.
    throw new Error(
      `[AlphaSeekers] FATAL: NODE_ENV=production but insecure demo toggles are enabled: ${insecure.join(
        ", ",
      )}. Disable them for production, or set ALPHASEEKERS_I_KNOW_THIS_IS_DEMO=true to override.`,
    );
  }

  if (runtime.mode === "production" && insecure.length > 0) {
    console.error(
      `[AlphaSeekers] SECURITY WARNING: production mode enabled but insecure demo toggles are on: ${insecure.join(
        ", ",
      )}.`,
    );
  }
}

