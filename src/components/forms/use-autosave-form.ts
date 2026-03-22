"use client";

import { useEffect } from "react";

export function useAutosaveForm<T extends Record<string, unknown>>(
  storageKey: string,
  value: T,
  onHydrate: (value: T) => void,
) {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);

      if (!stored) {
        return;
      }

      onHydrate(JSON.parse(stored) as T);
    } catch {
      // No-op for invalid local cache
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Ignore storage failures on restricted devices
    }
  }, [storageKey, value]);
}
