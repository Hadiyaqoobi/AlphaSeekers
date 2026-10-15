"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Person = { userId: string; name: string; email: string; teacher: boolean; attendance: string | null };

type IssuedRow = {
  code: string;
  userId: string | null;
  kind: "STUDENT_COMPLETION" | "TEACHER_RECOGNITION";
  recipientName: string;
  issuedAt: string;
  revokedAt: string | null;
};

type Props = {
  classId: string;
  canEdit: boolean;
  people: Person[];
  certificates: IssuedRow[];
  suggested: { length: string; term: string; hours: string };
};

/**
 * Issue and cancel a class's certificates (POST /api/admin/classes/[id]/certificates,
 * POST /api/admin/certificates/[code]/revoke). The certificate itself lives at
 * /en/verify/<code>, which is also what its QR code opens.
 */
export function ClassCertificates({ classId, canEdit, people, certificates, suggested }: Props) {
  const t = useTranslations("certificates");
  const router = useRouter();

  // A person's valid certificate for this class, if any (one per person and kind).
  const validFor = useMemo(() => {
    const map = new Map<string, IssuedRow>();
    for (const row of certificates) {
      if (!row.revokedAt && row.userId) map.set(`${row.userId}:${row.kind}`, row);
    }
    return map;
  }, [certificates]);
  const kindOf = (person: Person) => (person.teacher ? "TEACHER_RECOGNITION" : "STUDENT_COMPLETION");
  const holderOf = (person: Person) => validFor.get(`${person.userId}:${kindOf(person)}`) ?? null;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [length, setLength] = useState(suggested.length);
  const [term, setTerm] = useState(suggested.term);
  const [hours, setHours] = useState(suggested.hours);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const selectable = people.filter((person) => !holderOf(person));
  const students = selectable.filter((person) => !person.teacher);
  const teacherSelected = people.some((person) => person.teacher && selected.has(person.userId));
  const studentsSelected = people.some((person) => !person.teacher && selected.has(person.userId));
  const verifyPath = (code: string) => `/en/verify/${code}`;

  function toggle(userId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAllStudents() {
    const allOn = students.length > 0 && students.every((person) => selected.has(person.userId));
    setSelected((current) => {
      const next = new Set(current);
      for (const person of students) {
        if (allOn) next.delete(person.userId);
        else next.add(person.userId);
      }
      return next;
    });
  }

  async function issue() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/classes/${classId}/certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: people.filter((p) => !p.teacher && selected.has(p.userId)).map((p) => p.userId),
          includeTeacher: teacherSelected,
          length,
          term,
          hours,
          sendEmail,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        issued?: number;
        emailed?: number;
        alreadyHad?: number;
      };
      if (!response.ok) {
        setMessage({ tone: "error", text: body.message ?? t("issueFailed") });
        return;
      }
      setSelected(new Set());
      setMessage({
        tone: "ok",
        text: sendEmail
          ? t("issuedEmailed", { issued: body.issued ?? 0, emailed: body.emailed ?? 0 })
          : t("issued", { issued: body.issued ?? 0 }),
      });
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: t("issueFailed") });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(code: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/certificates/${encodeURIComponent(code)}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setMessage({ tone: "error", text: body.message ?? t("revokeFailed") });
        return;
      }
      setConfirming(null);
      setMessage({ tone: "ok", text: t("revoked", { code }) });
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: t("revokeFailed") });
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${verifyPath(code)}`);
      setCopied(code);
      setTimeout(() => setCopied((current) => (current === code ? null : current)), 2000);
    } catch {
      setMessage({ tone: "error", text: t("copyFailed") });
    }
  }

  const cancelled = certificates.filter((row) => row.revokedAt);
  const count = selected.size;

  return (
    <section className="panel panel-strong p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-ink-main">{t("title")}</h2>
        <span className="text-sm text-ink-soft">{t("validCount", { count: validFor.size })}</span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">{t("hint")}</p>

      {people.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{t("nobody")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-soft">
                {canEdit ? (
                  <th className="w-10 py-2" scope="col">
                    <input
                      aria-label={t("selectAllStudents")}
                      checked={students.length > 0 && students.every((person) => selected.has(person.userId))}
                      disabled={students.length === 0 || busy}
                      onChange={toggleAllStudents}
                      type="checkbox"
                    />
                  </th>
                ) : null}
                <th className="py-2 font-semibold" scope="col">{t("name")}</th>
                <th className="py-2 font-semibold" scope="col">{t("certificate")}</th>
                <th className="py-2 font-semibold" scope="col">{t("attendance")}</th>
                <th className="py-2 font-semibold" scope="col">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const holder = holderOf(person);
                return (
                  <tr className="border-b border-line-soft align-top text-ink-main" key={person.userId}>
                    {canEdit ? (
                      <td className="py-2">
                        <input
                          aria-label={t("selectPerson", { name: person.name })}
                          checked={selected.has(person.userId)}
                          disabled={Boolean(holder) || busy}
                          onChange={() => toggle(person.userId)}
                          type="checkbox"
                        />
                      </td>
                    ) : null}
                    <td className="py-2">
                      <p className="font-semibold" dir="auto">{person.name}</p>
                      {person.email ? <p className="text-xs text-ink-soft">{person.email}</p> : null}
                    </td>
                    <td className="py-2">{person.teacher ? t("kindTeacher") : t("kindStudent")}</td>
                    <td className="py-2">{person.attendance ?? <span className="text-ink-faint">-</span>}</td>
                    <td className="py-2">
                      {holder ? (
                        <div className="space-y-1">
                          <p className="font-mono text-xs text-neon-400">{holder.code}</p>
                          <div className="flex flex-wrap gap-3 text-xs font-semibold">
                            <a className="text-neon-400 hover:underline" href={verifyPath(holder.code)} rel="noreferrer" target="_blank">
                              {t("view")}
                            </a>
                            <button className="text-neon-400 hover:underline" onClick={() => copyLink(holder.code)} type="button">
                              {copied === holder.code ? t("copied") : t("copyLink")}
                            </button>
                            {canEdit ? (
                              confirming === holder.code ? (
                                <>
                                  <button
                                    className="text-red-300 hover:underline"
                                    disabled={busy}
                                    onClick={() => revoke(holder.code)}
                                    type="button"
                                  >
                                    {t("confirmRevoke")}
                                  </button>
                                  <button className="text-ink-soft hover:underline" onClick={() => setConfirming(null)} type="button">
                                    {t("keep")}
                                  </button>
                                </>
                              ) : (
                                <button className="text-red-300 hover:underline" onClick={() => setConfirming(holder.code)} type="button">
                                  {t("revoke")}
                                </button>
                              )
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-soft">{t("notIssued")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && people.length > 0 ? (
        <div className="mt-4 space-y-3 rounded-xl border border-line-soft p-3 sm:p-4">
          <p className="text-sm font-semibold text-ink-main">{t("wording")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-ink-soft">
              {t("lengthLabel")}
              <input
                className="field mt-1 w-full"
                disabled={!studentsSelected || busy}
                maxLength={40}
                onChange={(event) => setLength(event.target.value)}
                placeholder={t("lengthPlaceholder")}
                value={length}
              />
            </label>
            <label className="block text-xs text-ink-soft">
              {t("termLabel")}
              <input
                className="field mt-1 w-full"
                disabled={!teacherSelected || busy}
                maxLength={60}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={t("termPlaceholder")}
                value={term}
              />
            </label>
            <label className="block text-xs text-ink-soft">
              {t("hoursLabel")}
              <input
                className="field mt-1 w-full"
                disabled={!teacherSelected || busy}
                maxLength={40}
                onChange={(event) => setHours(event.target.value)}
                placeholder={t("hoursPlaceholder")}
                value={hours}
              />
            </label>
          </div>
          <p className="text-xs text-ink-soft">{t("wordingHint")}</p>
          <label className="flex items-center gap-2 text-sm text-ink-main">
            <input checked={sendEmail} disabled={busy} onChange={(event) => setSendEmail(event.target.checked)} type="checkbox" />
            {t("sendEmail")}
          </label>
          <button className="btn-primary" disabled={count === 0 || busy} onClick={issue} type="button">
            {busy ? t("issuing") : count === 0 ? t("chooseFirst") : t("issueButton", { count })}
          </button>
        </div>
      ) : null}

      {message ? (
        <p className={`mt-3 text-sm ${message.tone === "ok" ? "text-neon-400" : "text-red-300"}`} role="status">
          {message.text}
        </p>
      ) : null}

      {cancelled.length > 0 ? (
        <details className="mt-4 text-sm text-ink-soft">
          <summary className="cursor-pointer">{t("cancelledList", { count: cancelled.length })}</summary>
          <ul className="mt-2 space-y-1">
            {cancelled.map((row) => (
              <li key={row.code}>
                <span dir="auto">{row.recipientName}</span> · <span className="font-mono text-xs">{row.code}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
