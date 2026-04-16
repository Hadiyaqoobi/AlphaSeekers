"use client";

import { useCallback, useEffect, useState } from "react";

import { useTranslations } from "next-intl";

const MATERIAL_CACHE = "alphaseekers-materials-v1";

type SaveOfflineButtonProps = {
  fileUrl: string;
  title: string;
};

export function SaveOfflineButton({ fileUrl, title }: SaveOfflineButtonProps) {
  const t = useTranslations("offline");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    // Check if already cached
    caches.open(MATERIAL_CACHE).then((cache) =>
      cache.match(fileUrl).then((match) => {
        if (match) setStatus("saved");
      }),
    ).catch(() => {
      // caches not available
    });
  }, [fileUrl]);

  const handleSave = useCallback(async () => {
    setStatus("saving");
    try {
      const cache = await caches.open(MATERIAL_CACHE);
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("fetch failed");
      await cache.put(fileUrl, response);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [fileUrl]);

  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-neon-700">
        {t("savedOffline")}
      </span>
    );
  }

  return (
    <button
      className="text-xs font-medium text-ink-soft hover:text-ink-main"
      disabled={status === "saving"}
      onClick={handleSave}
      title={title}
      type="button"
    >
      {status === "saving" ? t("saving") : status === "error" ? t("retryOffline") : t("saveOffline")}
    </button>
  );
}
