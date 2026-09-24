"use client";

/**
 * The class join form — one page, four fields, one button.
 *
 * Shaped after the Google Forms the team and students already use, because
 * that is the form they know how to fill in. Everything here is in service of
 * a student on a phone, on a slow connection, who is not confident with
 * technology:
 *
 *  - ONE screen. No steps, no wizard, no "next".
 *  - Labels above fields, always visible — a placeholder that vanishes when you
 *    start typing is the classic way to lose someone who looks away mid-answer.
 *  - Large tap targets and 16px inputs (smaller text makes iOS zoom the page,
 *    which on a phone reads as the form jumping away from you).
 *  - The password rule is stated BEFORE they type, not as a red error after.
 *  - The submit button says what happens: "Join this class".
 *  - One submit does everything — account, password and class together. There
 *    is no second sign-up anywhere after this.
 */

import { useState } from "react";

import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type ClassJoinFormProps = {
  classId: string;
  locale: string;
  isFull: boolean;
};

export function ClassJoinForm({ classId, locale, isFull }: ClassJoinFormProps) {
  const t = useTranslations("classJoin");
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch(`/api/classes/${classId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          language: locale === "en" ? "EN" : "FA",
        }),
      });
    } catch {
      // Offline or the request never landed. Say so plainly rather than
      // leaving the button spinning.
      setError(t("networkError"));
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? t("failed"));
      setSubmitting(false);
      return;
    }

    // Account exists and they are in the class. Sign them in with the password
    // they just chose so they land INSIDE the class, not on a login screen.
    const signedIn = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);

    if (signedIn?.ok) {
      router.push(`/${locale}/classes/${classId}`);
      router.refresh();
      return;
    }

    // Joined, but the sign-in did not take. They ARE in the class; send them to
    // sign in with that said, never to a page implying something went wrong.
    router.push(`/${locale}/login?justRegistered=1`);
    router.refresh();
  }

  if (isFull) {
    return (
      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200" dir="auto">
        {t("classFull")}
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-ink-main" htmlFor="join-name">
          {t("nameLabel")}
        </label>
        <input
          autoComplete="name"
          className="join-field"
          id="join-name"
          onChange={(e) => setName(e.target.value)}
          required
          value={name}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-ink-main" htmlFor="join-email">
          {t("emailLabel")}
        </label>
        <input
          autoComplete="email"
          className="join-field"
          dir="ltr"
          id="join-email"
          inputMode="email"
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          value={email}
        />
        <p className="text-xs text-ink-faint" dir="auto">{t("emailHint")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-ink-main" htmlFor="join-password">
          {t("passwordLabel")}
        </label>
        {/* The rule is stated up front. Telling someone their password is wrong
            only after they submit is how you lose a nervous first-time user. */}
        <p className="text-xs text-ink-faint" dir="auto">{t("passwordHint")}</p>
        <div className="relative">
          <input
            autoComplete="new-password"
            className="join-field w-full pe-12"
            dir="ltr"
            id="join-password"
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          {/* Reveal toggle: typing a password blind on a phone keyboard is a
              common reason people give up.

              An ICON, not the word "Show" — as text inside an empty field it
              read as placeholder content, so the field looked pre-filled with
              the word "Show". Same eye control the sign-in page uses. */}
          <button
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            className="absolute inset-y-0 end-0 flex w-12 items-center justify-center text-ink-faint hover:text-ink-soft"
            onClick={() => setShowPassword((v) => !v)}
            type="button"
          >
            {showPassword ? (
              <svg fill="none" height="20" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" width="20">
                <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 5.1A9.6 9.6 0 0112 5c6.5 0 10 7 10 7a13 13 0 01-3 3.8M6 6.3A13 13 0 002 12s3.5 7 10 7a9.3 9.3 0 004-.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg fill="none" height="20" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" width="20">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error ? (
        <p
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          dir="auto"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button className="join-submit" disabled={submitting} type="submit">
        {submitting ? t("joining") : t("submit")}
      </button>

      <p className="text-center text-xs text-ink-faint" dir="auto">
        {t("alreadyHaveAccount")}{" "}
        <a className="font-semibold text-neon-400 underline-offset-2 hover:underline" href={`/${locale}/login`}>
          {t("signInInstead")}
        </a>
      </p>
    </form>
  );
}
