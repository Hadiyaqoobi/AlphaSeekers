"use client";

import { useEffect, useRef, useState } from "react";

import { useLocale, useTranslations } from "next-intl";

import { formatDateTime } from "@/lib/format-date";
import { formatKabulTime } from "@/lib/ui/kabul-time";

type JoinNowSession = {
  id: string;
  className: string;
  startTime: string;
  endTime: string;
  meetLink: string | null;
  continuation?: {
    sessionId: string;
    startTime: string;
    meetLink: string | null;
  } | null;
};

type JoinNowCardProps = {
  session: JoinNowSession;
};

export function JoinNowCard({ session }: JoinNowCardProps) {
  const timeoutRef = useRef<number | null>(null);
  const t = useTranslations("joinNow");
  // Times are formatted with a FIXED zone (Asia/Kabul) and the page locale, so
  // the server render and the browser render produce the same string. The old
  // toLocaleString() used each side's own zone/language, which never matched
  // and forced React to re-render the dashboard after hydration.
  const locale = useLocale();
  const [transitionArmed, setTransitionArmed] = useState(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function handleJoin() {
    if (!session.meetLink) {
      return;
    }

    const popup = window.open(session.meetLink, "_blank");

    if (!session.continuation?.meetLink) {
      return;
    }

    const delayMs = new Date(session.continuation.startTime).getTime() - Date.now();

    if (delayMs <= 0) {
      if (popup && !popup.closed) {
        popup.location.href = session.continuation.meetLink;
      } else {
        window.open(session.continuation.meetLink, "_blank");
      }
      return;
    }

    setTransitionArmed(true);
    timeoutRef.current = window.setTimeout(() => {
      if (popup && !popup.closed) {
        popup.location.href = session.continuation?.meetLink ?? session.meetLink!;
      } else if (session.continuation?.meetLink) {
        window.open(session.continuation.meetLink, "_blank");
      }
    }, delayMs);
  }

  const isOngoing = Date.now() >= new Date(session.startTime).getTime();

  return (
    <article className="hero-panel border-neon-200/70 p-4">
      <p className="section-kicker">{t("title")}</p>
      <h2 className="mt-1 text-lg font-black text-ink-main">{session.className}</h2>
      <p className="text-sm text-ink-main">
        {isOngoing
          ? t("inProgressAt", { time: formatDateTime(session.startTime, locale) })
          : t("startsAt", { time: formatDateTime(session.startTime, locale) })}
      </p>

      {session.meetLink ? (
        <button
          className="btn-primary mt-2"
          onClick={handleJoin}
          type="button"
        >
          {t("openVideo")}
        </button>
      ) : (
        <p className="mt-2 text-xs text-ink-soft">{t("meetPending")}</p>
      )}

      {session.continuation?.meetLink ? (
        <p className="mt-2 text-xs text-ink-main">
          {t("nextSegment", { time: formatKabulTime(session.continuation.startTime, locale) })}
          {transitionArmed ? ` ${t("autoSwitchArmed")}` : ""}
        </p>
      ) : null}
    </article>
  );
}
