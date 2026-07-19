/**
 * Tiny structured logger — dependency-free and isomorphic (browser + node).
 *
 * In production it emits a single JSON line per event so log aggregators can
 * parse it cleanly; in development it emits a compact, human-readable line.
 *
 * No node-only imports: `process.env.NODE_ENV` is statically inlined by the
 * bundler on the client, so this module is safe to import from client
 * components, server components, route handlers, and worker code alike.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function isProduction(): boolean {
  // Guard `process` access so this never throws in an exotic runtime; the
  // bundler inlines NODE_ENV for the browser build regardless.
  return typeof process !== "undefined" && process.env.NODE_ENV === "production";
}

function consoleFor(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case "error":
      return console.error.bind(console);
    case "warn":
      return console.warn.bind(console);
    case "debug":
      // Some environments lack console.debug; fall back to console.log.
      return (console.debug ?? console.log).bind(console);
    case "info":
    default:
      return (console.info ?? console.log).bind(console);
  }
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const time = new Date().toISOString();
  const write = consoleFor(level);

  if (isProduction()) {
    // Single JSON line. Spread context last but keep core fields authoritative
    // by assigning them after the spread.
    const record: Record<string, unknown> = { ...context, level, time, message };
    try {
      write(JSON.stringify(record));
    } catch {
      // Context may contain a circular structure; fall back to a safe line.
      write(JSON.stringify({ level, time, message }));
    }
    return;
  }

  // Development: readable line, with context appended as an object when present.
  const prefix = `[${level.toUpperCase()}] ${message}`;
  if (context && Object.keys(context).length > 0) {
    write(prefix, context);
  } else {
    write(prefix);
  }
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    emit("debug", message, context);
  },
  info(message: string, context?: LogContext): void {
    emit("info", message, context);
  },
  warn(message: string, context?: LogContext): void {
    emit("warn", message, context);
  },
  error(message: string, context?: LogContext): void {
    emit("error", message, context);
  },
};
