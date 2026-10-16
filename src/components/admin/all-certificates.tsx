"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Kind = "STUDENT_COMPLETION" | "TEACHER_RECOGNITION";

type Row = {
  code: string;
  kind: Kind;
  recipientName: string;
  className: string;
  /** Already formatted on the server, so it cannot differ after hydration. */
  issued: string;
  revoked: boolean;
};

type Props = {
  locale: string;
  canEdit: boolean;
  certificates: Row[];
};

/**
 * The admin Certificates page: issue one certificate for a course that has no
 * class here (POST /api/admin/certificates), and find, open, copy or cancel any
 * certificate (POST /api/admin/certificates/[code]/revoke).
 */
export function AllCertificates({ locale, canEdit, certificates }: Props) {
  const t = useTranslations("certificates");
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<Kind>("STUDENT_COMPLETION");
  const [className, setClassName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [length, setLength] = useState("");
  const [term, setTerm] = useState("");
  const [hours, setHours] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  // "form" messages show under the issue form, "list" ones above the list.
  const [message, setMessage] = useState<{
    at: "form" | "list";
    tone: "ok" | "error";
    text: string;
    code?: string;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const isTeacher = kind === "TEACHER_RECOGNITION";
  const ready =
    name.trim().length >= 2 && className.trim().length >= 2 && (isTeacher || teacherName.trim().length >= 2);
  const verifyPath = (code: string) => `/en/verify/${code}`;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return certificates;
    return certificates.filter((row) =>
      [row.recipientName, row.className, row.code].some((field) => field.toLowerCase().includes(q)),
    );
  }, [certificates, query]);
  const validTotal = certificates.filter((row) => !row.revoked).length;

  async function issue() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email || null,
          kind,
          className,
          teacherName: isTeacher ? null : teacherName,
          length: isTeacher ? null : length,
          term: isTeacher ? term : null,
          hours: isTeacher ? hours : null,
          sendEmail,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        issued?: number;
        emailed?: number;
        alreadyHad?: number;
        code?: string | null;
      };
      if (!response.ok) {
        setMessage({ at: "form", tone: "error", text: body.message ?? t("issueFailed") });
        return;
      }
      if ((body.issued ?? 0) === 0) {
        setMessage({ at: "form", tone: "error", text: t("alreadyHas") });
        return;
      }
      const code = body.code ?? "";
      setMessage({
        at: "form",
        tone: "ok",
        text: (body.emailed ?? 0) > 0 ? t("standaloneEmailed", { code }) : t("standaloneIssued", { code }),
        code,
      });
      // Keep the class, teacher and wording: staff usually issue several for one course.
      setName("");
      setEmail("");
      router.refresh();
    } catch {
      setMessage({ at: "form", tone: "error", text: t("issueFailed") });
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
        setMessage({ at: "list", tone: "error", text: body.message ?? t("revokeFailed") });
        return;
      }
      setConfirming(null);
      setMessage({ at: "list", tone: "ok", text: t("revoked", { code }) });
      router.refresh();
    } catch {
      setMessage({ at: "list", tone: "error", text: t("revokeFailed") });
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
      setMessage({ at: "list", tone: "error", text: t("copyFailed") });
    }
  }

  const statusMessage = (at: "form" | "list") =>
    message && message.at === at ? (
    <p className={`text-sm ${message.tone === "ok" ? "text-neon-400" : "text-red-300"}`} role="status">
      {message.text}{" "}
      {message.code ? (
        <a className="font-semibold underline" href={verifyPath(message.code)} rel="noreferrer" target="_blank">
          {t("view")}
        </a>
      ) : null}
    </p>
    ) : null;

  return (
    <>
      {canEdit ? (
        <section className="panel panel-strong space-y-3 p-4 sm:p-5">
          <h2 className="text-lg font-black text-ink-main">{t("standaloneTitle")}</h2>
          <p className="text-xs text-ink-soft">
            {t("standaloneHint")}{" "}
            <Link className="font-semibold text-neon-400 hover:underline" href={`/${locale}/admin/classes`}>
              {t("openClasses")}
            </Link>
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-ink-soft">
              {t("manualName")}
              <input
                className="field mt-1 w-full"
                dir="auto"
                disabled={busy}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("manualNamePlaceholder")}
                value={name}
              />
            </label>
            <label className="block text-xs text-ink-soft">
              {t("manualEmail")}
              <input
                className="field mt-1 w-full"
                disabled={busy}
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                type="email"
                value={email}
              />
            </label>
            <label className="block text-xs text-ink-soft">
              {t("manualKind")}
              <select
                className="select-field mt-1 w-full"
                disabled={busy}
                onChange={(event) => setKind(event.target.value as Kind)}
                value={kind}
              >
                <option value="STUDENT_COMPLETION">{t("kindStudent")}</option>
                <option value="TEACHER_RECOGNITION">{t("kindTeacher")}</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-ink-soft">
              {t("classNameLabel")}
              <input
                className="field mt-1 w-full"
                dir="auto"
                disabled={busy}
                maxLength={120}
                onChange={(event) => setClassName(event.target.value)}
                placeholder={t("classNamePlaceholder")}
                value={className}
              />
            </label>
            {isTeacher ? null : (
              <label className="block text-xs text-ink-soft">
                {t("teacherNameLabel")}
                <input
                  className="field mt-1 w-full"
                  dir="auto"
                  disabled={busy}
                  maxLength={100}
                  onChange={(event) => setTeacherName(event.target.value)}
                  placeholder={t("teacherNamePlaceholder")}
                  value={teacherName}
                />
              </label>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {isTeacher ? (
              <>
                <label className="block text-xs text-ink-soft">
                  {t("termLabel")}
                  <input
                    className="field mt-1 w-full"
                    disabled={busy}
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
                    disabled={busy}
                    maxLength={40}
                    onChange={(event) => setHours(event.target.value)}
                    placeholder={t("hoursPlaceholder")}
                    value={hours}
                  />
                </label>
              </>
            ) : (
              <label className="block text-xs text-ink-soft">
                {t("lengthLabel")}
                <input
                  className="field mt-1 w-full"
                  disabled={busy}
                  maxLength={40}
                  onChange={(event) => setLength(event.target.value)}
                  placeholder={t("lengthPlaceholder")}
                  value={length}
                />
              </label>
            )}
          </div>
          <p className="text-xs text-ink-soft">{t("standaloneOptional")}</p>

          <label className="flex items-center gap-2 text-sm text-ink-main">
            <input checked={sendEmail} disabled={busy} onChange={(event) => setSendEmail(event.target.checked)} type="checkbox" />
            {t("sendEmail")}
          </label>
          <button className="btn-primary" disabled={!ready || busy} onClick={issue} type="button">
            {busy ? t("issuing") : t("manualButton")}
          </button>
          {statusMessage("form")}
        </section>
      ) : null}

      <section className="panel panel-strong p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black text-ink-main">{t("allTitle")}</h2>
          {/* "None issued yet" would be wrong when every one issued was cancelled. */}
          {validTotal > 0 || certificates.length === 0 ? (
            <span className="text-sm text-ink-soft">{t("validCount", { count: validTotal })}</span>
          ) : null}
        </div>

        <div className="mt-2">{statusMessage("list")}</div>

        {certificates.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{t("noneYet")}</p>
        ) : (
          <>
            <input
              aria-label={t("search")}
              className="field mt-3 w-full sm:max-w-sm"
              dir="auto"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search")}
              type="search"
              value={query}
            />
            {shown.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">{t("noMatch")}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-ink-soft">
                      <th className="py-2 font-semibold" scope="col">{t("name")}</th>
                      <th className="py-2 font-semibold" scope="col">{t("colClass")}</th>
                      <th className="py-2 font-semibold" scope="col">{t("colIssued")}</th>
                      <th className="py-2 font-semibold" scope="col">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((row) => (
                      <tr className="border-b border-line-soft align-top text-ink-main" key={row.code}>
                        <td className="py-2">
                          <p className="font-semibold" dir="auto">{row.recipientName}</p>
                          <p className="text-xs text-ink-soft">
                            {row.kind === "TEACHER_RECOGNITION" ? t("kindTeacher") : t("kindStudent")}
                          </p>
                        </td>
                        <td className="py-2" dir="auto">{row.className}</td>
                        <td className="py-2 whitespace-nowrap">{row.issued}</td>
                        <td className="py-2">
                          <p className="font-mono text-xs text-neon-400">{row.code}</p>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
                            {row.revoked ? <span className="text-red-300">{t("cancelledBadge")}</span> : null}
                            <a className="text-neon-400 hover:underline" href={verifyPath(row.code)} rel="noreferrer" target="_blank">
                              {t("view")}
                            </a>
                            {row.revoked ? null : (
                              <button className="text-neon-400 hover:underline" onClick={() => copyLink(row.code)} type="button">
                                {copied === row.code ? t("copied") : t("copyLink")}
                              </button>
                            )}
                            {canEdit && !row.revoked ? (
                              confirming === row.code ? (
                                <>
                                  <button
                                    className="text-red-300 hover:underline"
                                    disabled={busy}
                                    onClick={() => revoke(row.code)}
                                    type="button"
                                  >
                                    {t("confirmRevoke")}
                                  </button>
                                  <button className="text-ink-soft hover:underline" onClick={() => setConfirming(null)} type="button">
                                    {t("keep")}
                                  </button>
                                </>
                              ) : (
                                <button className="text-red-300 hover:underline" onClick={() => setConfirming(row.code)} type="button">
                                  {t("revoke")}
                                </button>
                              )
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
