"use client";

import { useEffect, useRef, useState } from "react";

import { useTranslations } from "next-intl";

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
          ? t("inProgressAt", { time: new Date(session.startTime).toLocaleString() })
          : t("startsAt", { time: new Date(session.startTime).toLocaleString() })}
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
          {t("nextSegment", { time: new Date(session.continuation.startTime).toLocaleTimeString() })}
          {transitionArmed ? ` ${t("autoSwitchArmed")}` : ""}
        </p>
      ) : null}
    </article>
  );
}
