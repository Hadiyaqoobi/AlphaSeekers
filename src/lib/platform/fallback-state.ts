type StorageMode = "database" | "memory";

export type StoreFallbackState = {
  mode: StorageMode;
  switchedAt: string | null;
  reason: string | null;
  error: string | null;
};

const state: StoreFallbackState = {
  mode: "database",
  switchedAt: null,
  reason: null,
  error: null,
};

function normalizeError(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Unknown error";
}

export function reportUsingDatabase() {
  if (state.mode === "database") {
    return;
  }

  state.mode = "database";
  state.switchedAt = new Date().toISOString();
  state.reason = "database available";
  state.error = null;

  console.warn("[AlphaSeekers] Store switched to DATABASE mode.");
}

export function reportUsingMemory(reason: string, error?: unknown) {
  if (state.mode === "memory") {
    // Keep the first switch time but update latest reason/error for visibility.
    state.reason = reason;
    state.error = normalizeError(error);
    return;
  }

  state.mode = "memory";
  state.switchedAt = new Date().toISOString();
  state.reason = reason;
  state.error = normalizeError(error);

  console.error(
    "[AlphaSeekers] Store switched to MEMORY fallback mode:",
    reason,
    state.error ? `(${state.error})` : "",
  );
}

export function getStoreFallbackState(): StoreFallbackState {
  return { ...state };
}
