"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

type ScheduleItem = {
  id: string;
  className: string;
  startTime: string;
  meetLink: string | null;
};

type SchedulePayload = {
  generatedAt: string;
  items: ScheduleItem[];
};

const STORAGE_KEY = "alphaseekers-schedule-cache";
const STALE_AFTER_DAYS = 7;

export function OfflineSchedule() {
  const t = useTranslations("offlineSchedule");
  const [data, setData] = useState<SchedulePayload | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cached = localStorage.getItem(STORAGE_KEY);

      if (cached) {
        try {
          const parsed = JSON.parse(cached) as SchedulePayload;
          if (!cancelled) {
            setData(parsed);
          }
        } catch {
          // Ignore parse errors
        }
      }

      try {
        const response = await fetch("/api/me/schedule", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Schedule request failed");
        }

        const payload = (await response.json()) as SchedulePayload;
        if (!cancelled) {
          setData(payload);
          setOffline(false);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        if (!cancelled) {
          setOffline(true);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!data && !offline) {
    return <p className="text-sm text-ink-soft">{t("loading")}</p>;
  }

  if (!data && offline) {
    return <p className="text-sm text-amber-700">{t("offlineNoCache")}</p>;
  }

  const generatedAt = data ? new Date(data.generatedAt) : null;
  const stale = Boolean(
    generatedAt && Date.now() - generatedAt.getTime() > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000,
  );

  return (
    <section className="panel panel-strong space-y-2 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-ink-main">{t("title")}</h3>
        {offline ? (
          <p className="text-xs font-semibold text-amber-700">
            {generatedAt
              ? t("offlineModeWithTime", { time: generatedAt.toLocaleString() })
              : t("offlineMode")}
          </p>
        ) : (
          <p className="text-xs text-ink-soft">{t("updated", { time: new Date(data!.generatedAt).toLocaleString() })}</p>
        )}
      </header>

      {offline && stale ? (
        <p className="text-xs font-semibold text-amber-800">
          {t("staleWarning", { days: STALE_AFTER_DAYS })}
        </p>
      ) : null}

      <div className="space-y-2">
        {data!.items.slice(0, 6).map((item) => (
          <article className="stat-card p-3" key={item.id}>
            <p className="text-sm font-semibold text-ink-main">{item.className}</p>
            <p className="text-xs text-ink-soft">{new Date(item.startTime).toLocaleString()}</p>
            {item.meetLink ? (
              <a className="text-xs font-semibold text-sky-700 underline-offset-2 hover:underline" href={item.meetLink} rel="noreferrer" target="_blank">
                {t("joinLink")}
              </a>
            ) : (
              <p className="text-xs text-ink-soft">{t("meetPending")}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
