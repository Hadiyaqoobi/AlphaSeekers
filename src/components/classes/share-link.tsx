"use client";

/**
 * The link staff send to students, shown on the class page itself.
 *
 * It used to appear exactly once — on the confirmation screen right after the
 * class was created — and nowhere else. Close that screen and the only way back
 * was to know that /classes/<id> becomes /join/<id> by hand-editing the URL,
 * which is not something to ask of a volunteer on a phone.
 *
 * Staff-only: students already have the class, and this is the one address that
 * must never be confused with the Meet link.
 */

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

export function ShareLink({ classId, locale }: { classId: string; locale: string }) {
  const t = useTranslations("classDetail");
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  // Built in the browser so it always carries the domain staff are actually on,
  // rather than a base URL guessed on the server.
  //
  // Set in an effect rather than read inline during render: `window` does not
  // exist on the server, so an inline check renders "" on the server and the
  // real URL on the client, and React fails hydration on the mismatch —
  // "Text content does not match server-rendered HTML", which tears down and
  // re-renders this whole branch. Starting empty on both sides and filling in
  // after mount keeps the two renders identical.
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(`${window.location.origin}/${locale}/join/${classId}`);
  }, [classId, locale]);

  async function copy() {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard is blocked on some in-app browsers and any non-HTTPS origin.
      // Say so, and leave the text selectable so it can still be copied by hand.
      setFailed(true);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-line-soft bg-dark-50/40 p-3 sm:p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint" dir="auto">
        {t("shareLinkLabel")}
      </p>
      <p className="mt-1 text-xs text-ink-soft" dir="auto">
        {t("shareLinkHint")}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-line-soft bg-dark-100 px-3 py-2 text-xs text-ink-main">
          {url || "\u00a0"}
        </code>
        <button
          className="btn-secondary !min-h-[2.25rem] !px-4 !text-xs"
          disabled={!url}
          onClick={copy}
          type="button"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
      {failed ? (
        <p className="mt-2 text-xs text-amber-500" dir="auto">
          {t("copyFailed")}
        </p>
      ) : null}
    </div>
  );
}
