"use client";

import { useState } from "react";

interface BilingualToggleProps {
  enContent: string;
  daContent: string;
  locale: string;
}

export function BilingualToggle({ enContent, daContent, locale }: BilingualToggleProps) {
  const [showDari, setShowDari] = useState(locale === "fa");

  const activeContent = showDari ? daContent : enContent;
  const activeDir = showDari ? "rtl" : "ltr";

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => setShowDari(false)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !showDari
              ? "bg-neon-50 text-neon-700"
              : "text-ink-soft hover:text-ink-main"
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => setShowDari(true)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            showDari
              ? "bg-neon-50 text-neon-700"
              : "text-ink-soft hover:text-ink-main"
          }`}
        >
          دری
        </button>
      </div>
      <div
        className="story-content prose prose-slate max-w-none"
        dir={activeDir}
        dangerouslySetInnerHTML={{ __html: activeContent }}
      />
    </div>
  );
}
