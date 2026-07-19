/**
 * Pluggable, dependency-free error reporting.
 *
 * `reportError` ALWAYS records the error through our structured logger, and
 * ADDITIONALLY forwards it to an external error tracker through an optional,
 * INJECTED adapter. Dependency injection (not a dynamic import of an
 * uninstalled package) keeps this dependency-free AND build-clean — a bundler
 * can't choke on a package that's never imported here.
 *
 * ── Activating Sentry (or a compatible tracker) ──────────────────────────────
 *   1. `npm install @sentry/node`
 *   2. In an `instrumentation.ts` (server) init Sentry, then register the seam:
 *        import * as Sentry from "@sentry/node";
 *        Sentry.init({ dsn: process.env.SENTRY_DSN });
 *        setErrorReporter({
 *          captureException: (e, ctx) => Sentry.captureException(e, { extra: ctx }),
 *          captureMessage:   (m, ctx) => Sentry.captureMessage(m, { extra: ctx }),
 *        });
 *
 * Until then, `reportError`/`captureMessage` simply structured-log (which any
 * log aggregator — including Render's — ingests), so nothing is lost today.
 */

import { logger } from "@/lib/observability/logger";

type ReportContext = Record<string, unknown>;

/** The shape an external tracker (Sentry, etc.) is adapted to. */
export type ExternalReporter = {
  captureException: (error: unknown, context?: ReportContext) => void;
  captureMessage: (message: string, context?: ReportContext) => void;
};

let externalReporter: ExternalReporter | null = null;

/** Register an external error tracker. Call once at process start (instrumentation). */
export function setErrorReporter(reporter: ExternalReporter | null): void {
  externalReporter = reporter;
}

function normalizeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (typeof error === "string") {
    return { name: "Error", message: error };
  }
  try {
    return { name: "NonError", message: JSON.stringify(error) };
  } catch {
    return { name: "NonError", message: String(error) };
  }
}

/**
 * Report an error: always logs it, then best-effort forwards to the injected
 * external tracker (if any). Never throws.
 */
export async function reportError(error: unknown, context?: ReportContext): Promise<void> {
  const { name, message, stack } = normalizeError(error);
  logger.error(message || name, { ...context, errorName: name, stack });
  try {
    externalReporter?.captureException(error, context);
  } catch {
    // A tracker failure must never propagate into the caller's error path.
  }
}

/**
 * Report a standalone message (non-exception signal): always logs, then
 * best-effort forwards to the injected tracker (if any). Never throws.
 */
export async function captureMessage(message: string, context?: ReportContext): Promise<void> {
  logger.info(message, context);
  try {
    externalReporter?.captureMessage(message, context);
  } catch {
    // Swallow — the structured log above already captured the signal.
  }
}
