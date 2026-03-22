"use client";

import { useTranslations } from "next-intl";

interface DataCostBadgeProps {
  /** File size in bytes */
  fileSize: number | null | undefined;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateCost(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  const minCost = gb * 1;
  const maxCost = gb * 3;
  if (maxCost < 0.001) return "<$0.001";
  return `$${minCost.toFixed(3)}–$${maxCost.toFixed(3)}`;
}

export function DataCostBadge({ fileSize }: DataCostBadgeProps) {
  const t = useTranslations("dataCost");

  if (!fileSize || fileSize <= 0) return null;

  const size = formatSize(fileSize);
  const cost = estimateCost(fileSize);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
      title={t("label", { size, cost })}
    >
      <span aria-hidden="true">&#x1F4E1;</span>
      {size} <span className="text-amber-600">~{cost}</span>
    </span>
  );
}
