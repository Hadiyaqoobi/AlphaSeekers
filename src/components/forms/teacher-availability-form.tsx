"use client";

import { useEffect, useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import { useAutosaveForm } from "@/components/forms/use-autosave-form";

type Slot = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

type DayForm = {
  enabled: boolean;
  start: string;
  end: string;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function minutesToClock(minutes: number) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function clockToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function TeacherAvailabilityForm() {
  const t = useTranslations("teacherForms");
  const [days, setDays] = useState<DayForm[]>(
    DAY_KEYS.map(() => ({
      enabled: false,
      start: "17:00",
      end: "19:00",
    })),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useAutosaveForm("teacher-availability-draft", { days }, (payload) => {
    if (payload.days && Array.isArray(payload.days)) {
      setDays(payload.days as DayForm[]);
    }
  });

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch("/api/teacher/availability", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as { items: Array<Slot & { id: string }> };

      if (!active) {
        return;
      }

      const initial = DAY_KEYS.map(() => ({
        enabled: false,
        start: "17:00",
        end: "19:00",
      }));

      body.items.forEach((slot) => {
        initial[slot.dayOfWeek] = {
          enabled: true,
          start: minutesToClock(slot.startMinute),
          end: minutesToClock(slot.endMinute),
        };
      });

      setDays(initial);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const slots = useMemo(
    () =>
      days
        .map((day, index) => ({
          dayOfWeek: index,
          startMinute: clockToMinutes(day.start),
          endMinute: clockToMinutes(day.end),
          enabled: day.enabled,
        }))
        .filter((slot) => slot.enabled)
        .map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          startMinute: slot.startMinute,
          endMinute: slot.endMinute,
        })),
    [days],
  );

  async function save() {
    setSaving(true);
    setMessage(null);

    const response = await fetch("/api/teacher/availability", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slots }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: t("saveFailed") }))) as { message?: string };
      setMessage(body.message ?? t("saveFailed"));
      setSaving(false);
      return;
    }

    setMessage(t("saved"));
    setSaving(false);
  }

  return (
    <section className="panel panel-strong space-y-4 p-5 sm:p-6">
      <header className="space-y-1">
        <p className="section-kicker">{t("scheduling")}</p>
        <h1 className="text-2xl font-black text-ink-main">{t("title")}</h1>
        <p className="text-sm text-ink-soft">{t("subtitle")}</p>
      </header>

      <div className="space-y-3">
        {days.map((day, index) => (
          <article className="stat-card p-3" key={DAY_KEYS[index]}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-main">
                <input
                  checked={day.enabled}
                  onChange={(event) => {
                    setDays((current) =>
                      current.map((entry, i) => (i === index ? { ...entry, enabled: event.target.checked } : entry)),
                    );
                  }}
                  type="checkbox"
                />
                {t(DAY_KEYS[index])}
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-ink-soft">
                {t("start")}
                <input
                  className="rounded-lg border border-line-DEFAULT bg-dark-100 px-2 py-1"
                  disabled={!day.enabled}
                  onChange={(event) =>
                    setDays((current) =>
                      current.map((entry, i) => (i === index ? { ...entry, start: event.target.value } : entry)),
                    )
                  }
                  type="time"
                  value={day.start}
                />
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-ink-soft">
                {t("end")}
                <input
                  className="rounded-lg border border-line-DEFAULT bg-dark-100 px-2 py-1"
                  disabled={!day.enabled}
                  onChange={(event) =>
                    setDays((current) =>
                      current.map((entry, i) => (i === index ? { ...entry, end: event.target.value } : entry)),
                    )
                  }
                  type="time"
                  value={day.end}
                />
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          className="btn-primary"
          disabled={saving}
          onClick={save}
          type="button"
        >
          {saving ? t("saving") : t("save")}
        </button>
        {message ? <p className="text-sm text-ink-main">{message}</p> : null}
      </div>
    </section>
  );
}
