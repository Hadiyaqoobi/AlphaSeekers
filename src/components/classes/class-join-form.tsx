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
 *  - The class's own questions (ADR-0009) sit under name and email, so the
 *    "Google Form" the team wanted is this same page, and answering it puts the
 *    student IN the class.
 *  - "Join with Google" for students with Gmail: no password to invent. They
 *    come back here signed in, and the form finishes the join by itself.
 */

import { useEffect, useRef, useState } from "react";

import { useTranslations } from "next-intl";
import { getProviders, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { checkAnswers, optionLabel, questionLabel, type JoinAnswers, type JoinQuestion } from "@/lib/platform/join-questions";
import { messageForCode, readErrorBody } from "@/lib/ui/api-error";
import { passwordProblem } from "@/lib/ui/password-policy";
import { loginHref } from "@/lib/ui/safe-next";

type ClassJoinFormProps = {
  classId: string;
  locale: string;
  isFull: boolean;
  questions?: JoinQuestion[];
  /**
   * "member": the visitor is already signed in as a student (for example just
   * back from Google), so only the questions and the join button are shown.
   */
  mode?: "guest" | "member";
  /** member mode: their name, so they can see which account is joining. */
  memberName?: string | null;
  /** member mode: they just came back from Google; finish the join without another tap. */
  autoSubmit?: boolean;
};

/** Answers typed before going to Google, so the student does not type them twice. */
const draftKey = (classId: string) => `as:join-answers:${classId}`;

function loadDraft(classId: string): JoinAnswers {
  try {
    const raw = window.sessionStorage.getItem(draftKey(classId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as JoinAnswers) : {};
  } catch {
    return {};
  }
}

function saveDraft(classId: string, answers: JoinAnswers | null) {
  try {
    if (answers) window.sessionStorage.setItem(draftKey(classId), JSON.stringify(answers));
    else window.sessionStorage.removeItem(draftKey(classId));
  } catch {
    // Blocked storage: worst case they type the answers again after Google.
  }
}

export function ClassJoinForm({
  classId,
  locale,
  isFull,
  questions = [],
  mode = "guest",
  memberName = null,
  autoSubmit = false,
}: ClassJoinFormProps) {
  const t = useTranslations("classJoin");
  const tRegister = useTranslations("register");
  const tEnroll = useTranslations("enroll");
  const tq = useTranslations("joinQuestions");
  const tqKey = (key: string) => tq(key);
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [answers, setAnswers] = useState<JoinAnswers>({});
  const [questionError, setQuestionError] = useState<{ id: string; reason: "required" | "invalid" } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const autoSubmitted = useRef(false);

  // Same probe as the sign-in page: the button only appears when Google
  // sign-in is actually configured on the server.
  useEffect(() => {
    if (mode !== "guest") return;
    let cancelled = false;
    getProviders()
      .then((providers) => {
        if (!cancelled) setGoogleEnabled(Boolean(providers?.google));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Back from Google: restore what they typed, and if nothing is missing,
  // finish joining straight away. One tap on "Join with Google" is the whole join.
  useEffect(() => {
    if (mode !== "member") return;
    const restored = loadDraft(classId);
    setAnswers(restored);
    if (autoSubmit && !autoSubmitted.current && checkAnswers(questions, restored).ok) {
      autoSubmitted.current = true;
      void joinAsMember(restored);
    }
    // Runs once on arrival; joinAsMember reads only stable props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, classId]);

  function setAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
    if (questionError?.id === id) setQuestionError(null);
  }

  /** Check the questions here first; returns false (and points at the problem) if any is unanswered. */
  function answersReady(): boolean {
    const check = checkAnswers(questions, answers);
    if (check.ok) return true;
    setQuestionError({ id: check.questionId, reason: check.reason });
    document.getElementById(`join-q-${check.questionId}`)?.focus();
    return false;
  }

  /** The server refused an answer: point at that question, like the client check does. */
  function showServerQuestionError(body: Record<string, unknown> | null): boolean {
    if (body?.code !== "INVALID_ANSWERS" || typeof body.questionId !== "string") return false;
    setQuestionError({ id: body.questionId, reason: "invalid" });
    document.getElementById(`join-q-${body.questionId}`)?.focus();
    return true;
  }

  function joinWithGoogle() {
    setError(null);
    setGoogleSubmitting(true);
    saveDraft(classId, answers);
    void signIn("google", { callbackUrl: `/${locale}/join/${classId}?via=google` });
  }

  async function joinAsMember(given: JoinAnswers) {
    setError(null);
    setSubmitting(true);
    let response: Response;
    try {
      response = await fetch(`/api/classes/${classId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: given }),
      });
    } catch {
      setError(t("networkError"));
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      const body = await readErrorBody(response);
      if (!showServerQuestionError(body)) {
        setError(
          body?.code === "ENROLLMENT_LIMIT" && typeof body.limit === "number"
            ? tEnroll("limitReached", { limit: body.limit })
            : messageForCode(
                body as { code?: unknown },
                {
                  CLASS_FULL: t("classFull"),
                  REGISTRATION_CLOSED: t("errors.registrationClosed"),
                  ENROLLMENT_REJECTED: tEnroll("rejected"),
                },
                t("failed"),
              ),
        );
      }
      setSubmitting(false);
      return;
    }

    saveDraft(classId, null);
    router.push(`/${locale}/classes/${classId}`);
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!answersReady()) return;

    if (mode === "member") {
      await joinAsMember(answers);
      return;
    }

    // Same rule the server enforces, checked here so a slow connection does
    // not cost a round trip to learn the password is too weak.
    if (passwordProblem(password)) {
      setError(t("errors.password"));
      return;
    }
    setSubmitting(true);

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
          ...(questions.length ? { answers } : {}),
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
      // Translate by code; the server's English `message` is never shown.
      const body = await readErrorBody(response);
      if (showServerQuestionError(body)) {
        setSubmitting(false);
        return;
      }
      const field = Array.isArray(body?.errors)
        ? (body.errors as Array<{ field?: unknown }>)[0]?.field
        : undefined;
      const byField: Record<string, string> = {
        name: t("errors.name"),
        email: tRegister("emailInvalid"),
        password: t("errors.password"),
      };
      setError(
        typeof field === "string" && byField[field]
          ? byField[field]
          : messageForCode(
              body as { code?: unknown },
              {
                RATE_LIMITED: t("errors.rateLimited"),
                CLASS_NOT_FOUND: t("errors.notFound"),
                CLASS_CLOSED: t("errors.closed"),
                CLASS_FULL: t("classFull"),
                REGISTRATION_CLOSED: t("errors.registrationClosed"),
                WRONG_PASSWORD: t("errors.wrongPassword"),
                ACCOUNT_DEACTIVATED: t("errors.deactivated"),
                NOT_A_STUDENT: t("errors.notAStudent"),
                USE_SIGN_IN: t("errors.notAStudent"),
                NOT_ALLOWED: tEnroll("rejected"),
              },
              t("failed"),
            ),
      );
      setSubmitting(false);
      return;
    }

    saveDraft(classId, null);

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
    router.push(
      `/${locale}/login?justRegistered=1&next=${encodeURIComponent(`/${locale}/classes/${classId}`)}`,
    );
    router.refresh();
  }

  if (isFull) {
    return (
      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200" dir="auto">
        {t("classFull")}
      </p>
    );
  }

  const questionFields = questions.map((question) => {
    const id = `join-q-${question.id}`;
    const label = questionLabel(question, tqKey);
    const problem = questionError?.id === question.id ? questionError.reason : null;
    const value = answers[question.id] ?? "";
    return (
      <div className="flex flex-col gap-1.5" key={question.id}>
        {question.type === "choice" ? (
          <fieldset aria-describedby={problem ? `${id}-error` : undefined} className="flex flex-col gap-2" id={id} tabIndex={-1}>
            <legend className="mb-1.5 text-sm font-semibold text-ink-main" dir="auto">
              {label}
              {question.required ? null : <span className="font-normal text-ink-faint"> {tq("optional")}</span>}
            </legend>
            {(question.options ?? []).map((option) => (
              <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-line-soft px-3 text-sm text-ink-soft" key={option}>
                <input
                  checked={value === option}
                  name={id}
                  onChange={() => setAnswer(question.id, option)}
                  type="radio"
                  value={option}
                />
                <span dir="auto">{optionLabel(question, option, tqKey)}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <>
            <label className="text-sm font-semibold text-ink-main" dir="auto" htmlFor={id}>
              {label}
              {question.required ? null : <span className="font-normal text-ink-faint"> {tq("optional")}</span>}
            </label>
            {question.type === "paragraph" ? (
              <textarea
                aria-describedby={problem ? `${id}-error` : undefined}
                className="join-field min-h-[104px]"
                dir="auto"
                id={id}
                maxLength={2000}
                onChange={(e) => setAnswer(question.id, e.target.value)}
                rows={4}
                value={value}
              />
            ) : (
              <input
                aria-describedby={problem ? `${id}-error` : undefined}
                autoComplete={question.kind === "phone" ? "tel" : "off"}
                className="join-field"
                dir={question.kind === "phone" || question.kind === "age" ? "ltr" : "auto"}
                id={id}
                inputMode={question.kind === "phone" ? "tel" : question.kind === "age" ? "numeric" : undefined}
                maxLength={200}
                onChange={(e) => setAnswer(question.id, e.target.value)}
                type={question.kind === "phone" ? "tel" : "text"}
                value={value}
              />
            )}
          </>
        )}
        {problem ? (
          <p className="text-xs text-red-300" dir="auto" id={`${id}-error`} role="alert">
            {problem === "required" ? tq("errors.required") : tq(`errors.invalid.${question.kind === "phone" || question.kind === "age" ? question.kind : "other"}`)}
          </p>
        ) : null}
      </div>
    );
  });

  const errorNode = error ? (
    <p
      className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
      dir="auto"
      role="alert"
    >
      {error}
    </p>
  ) : null;

  // Signed in already (often just back from Google): nothing to create, only
  // the class's questions and one button.
  if (mode === "member") {
    return (
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        {memberName ? (
          <p className="text-sm text-ink-soft" dir="auto">{t("signedInAs", { name: memberName })}</p>
        ) : null}
        {questionFields}
        {errorNode}
        <button className="join-submit" disabled={submitting} type="submit">
          {submitting ? t("joining") : t("submit")}
        </button>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      {googleEnabled ? (
        <>
          {/* One tap for anyone with Gmail: no password to invent now and none
              to forget later. Answers typed below are carried across. */}
          <button className="auth-google" disabled={googleSubmitting || submitting} onClick={joinWithGoogle} type="button">
            <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
              <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 009 18z" fill="#34A853" />
              <path d="M3.97 10.72a5.4 5.4 0 010-3.44V4.95H.96a9 9 0 000 8.1l3.01-2.33z" fill="#FBBC05" />
              <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 00.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
            </svg>
            <span>{googleSubmitting ? t("joining") : t("joinWithGoogle")}</span>
          </button>
          <div className="auth-divider" role="separator">
            <span>{t("orFillIn")}</span>
          </div>
        </>
      ) : null}

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

      {/* The class's own questions, under name and email (ADR-0009). */}
      {questionFields}

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

      {errorNode}

      <button className="join-submit" disabled={submitting} type="submit">
        {submitting ? t("joining") : t("submit")}
      </button>

      <p className="text-center text-xs text-ink-faint" dir="auto">
        {t("alreadyHaveAccount")}{" "}
        <a className="font-semibold text-neon-400 underline-offset-2 hover:underline" href={loginHref(locale, `/${locale}/classes/${classId}`)}>
          {t("signInInstead")}
        </a>
      </p>
    </form>
  );
}
