"use client";

/**
 * "Questions for students" — the part of the class form that replaces making a
 * separate Google Form (ADR-0009).
 *
 * Built for volunteers who found posting a class confusing: the common
 * questions are one tick each, and writing your own is one button. Nothing here
 * is required; a class with no questions still has the plain name/email join page.
 */
import { useTranslations } from "next-intl";

import {
  MAX_CUSTOM_QUESTIONS,
  PRESET_KINDS,
  PRESETS,
  type JoinQuestion,
  type PresetKind,
  type QuestionType,
} from "@/lib/platform/join-questions";

/** Editing state: a custom choice question's options are typed one per line. */
export type DraftQuestion = JoinQuestion & { optionsText?: string };

/** Saved questions → editor state. */
export function toDraft(questions: JoinQuestion[]): DraftQuestion[] {
  return questions.map((q) => (q.kind === "custom" && q.type === "choice" ? { ...q, optionsText: (q.options ?? []).join("\n") } : q));
}

/** Editor state → what the server accepts. Presets first, in a fixed order. */
export function toPayload(draft: DraftQuestion[]): JoinQuestion[] {
  const presets = PRESET_KINDS.flatMap((kind) => draft.filter((q) => q.kind === kind).slice(0, 1));
  const customs = draft.filter((q) => q.kind === "custom");
  return [
    ...presets.map(({ id, kind, required }) => ({ id, kind, type: PRESETS[kind as PresetKind].type, required })),
    ...customs.map(({ id, type, label, optionsText, required }) => ({
      id,
      kind: "custom" as const,
      type,
      label: (label ?? "").trim(),
      required,
      ...(type === "choice"
        ? { options: (optionsText ?? "").split("\n").map((o) => o.trim()).filter(Boolean) }
        : {}),
    })),
  ];
}

const LABEL = "text-xs font-semibold text-ink-soft";

function newCustomId(existing: DraftQuestion[]): string {
  for (let n = 1; ; n += 1) {
    const id = `q${n}`;
    if (!existing.some((q) => q.id === id)) return id;
  }
}

type Props = {
  value: DraftQuestion[];
  onChange: (next: DraftQuestion[]) => void;
  /** Prefix for element ids, so the create and edit forms can share a page. */
  idPrefix: string;
};

export function JoinQuestionsEditor({ value, onChange, idPrefix }: Props) {
  const t = useTranslations("joinQuestions");
  const customs = value.filter((q) => q.kind === "custom");

  function togglePreset(kind: PresetKind, on: boolean) {
    onChange(
      on
        ? [...value, { id: kind, kind, type: PRESETS[kind].type, required: false }]
        : value.filter((q) => q.kind !== kind),
    );
  }

  function patch(id: string, changes: Partial<DraftQuestion>) {
    onChange(value.map((q) => (q.id === id ? { ...q, ...changes } : q)));
  }

  function addCustom() {
    if (customs.length >= MAX_CUSTOM_QUESTIONS) return;
    onChange([...value, { id: newCustomId(value), kind: "custom", type: "short", label: "", required: false }]);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-faint">{t("editor.hint")}</p>

      <div className="space-y-2">
        <p className={LABEL}>{t("editor.readyMade")}</p>
        {PRESET_KINDS.map((kind) => {
          const current = value.find((q) => q.kind === kind);
          const boxId = `${idPrefix}-preset-${kind}`;
          return (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-soft px-3 py-2" key={kind}>
              <label className="flex items-center gap-2 text-sm text-ink-main" htmlFor={boxId}>
                <input
                  checked={Boolean(current)}
                  id={boxId}
                  onChange={(event) => togglePreset(kind, event.target.checked)}
                  type="checkbox"
                />
                <span>{t(`labels.${kind}`)}</span>
              </label>
              {current ? (
                <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <input
                    checked={current.required}
                    onChange={(event) => patch(kind, { required: event.target.checked })}
                    type="checkbox"
                  />
                  {t("editor.mustAnswer")}
                </label>
              ) : null}
            </div>
          );
        })}
      </div>

      {customs.length > 0 ? (
        <div className="space-y-3">
          <p className={LABEL}>{t("editor.yourOwn")}</p>
          {customs.map((q, index) => (
            <div className="space-y-2 rounded-lg border border-line-soft p-3" key={q.id}>
              <div className="space-y-1">
                <label className={LABEL} htmlFor={`${idPrefix}-${q.id}-label`}>
                  {t("editor.question", { number: index + 1 })}
                </label>
                <input
                  className="field"
                  dir="auto"
                  id={`${idPrefix}-${q.id}-label`}
                  maxLength={200}
                  onChange={(event) => patch(q.id, { label: event.target.value })}
                  placeholder={t("editor.questionPlaceholder")}
                  required
                  value={q.label ?? ""}
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className={LABEL} htmlFor={`${idPrefix}-${q.id}-type`}>{t("editor.answerType")}</label>
                  <select
                    className="select-field"
                    id={`${idPrefix}-${q.id}-type`}
                    onChange={(event) => patch(q.id, { type: event.target.value as QuestionType })}
                    value={q.type}
                  >
                    <option value="short">{t("editor.typeShort")}</option>
                    <option value="paragraph">{t("editor.typeParagraph")}</option>
                    <option value="choice">{t("editor.typeChoice")}</option>
                  </select>
                </div>
                <label className="flex items-center gap-1.5 pb-2 text-xs text-ink-soft">
                  <input
                    checked={q.required}
                    onChange={(event) => patch(q.id, { required: event.target.checked })}
                    type="checkbox"
                  />
                  {t("editor.mustAnswer")}
                </label>
                <button
                  className="pb-2 text-xs font-semibold text-red-300 hover:underline"
                  onClick={() => onChange(value.filter((other) => other.id !== q.id))}
                  type="button"
                >
                  {t("editor.remove")}
                </button>
              </div>
              {q.type === "choice" ? (
                <div className="space-y-1">
                  <label className={LABEL} htmlFor={`${idPrefix}-${q.id}-options`}>{t("editor.options")}</label>
                  <textarea
                    className="area-field"
                    dir="auto"
                    id={`${idPrefix}-${q.id}-options`}
                    onChange={(event) => patch(q.id, { optionsText: event.target.value })}
                    placeholder={t("editor.optionsPlaceholder")}
                    rows={3}
                    value={q.optionsText ?? ""}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {customs.length < MAX_CUSTOM_QUESTIONS ? (
        <button className="btn-secondary text-sm" onClick={addCustom} type="button">
          + {t("editor.addOwn")}
        </button>
      ) : (
        <p className="text-xs text-ink-faint">{t("editor.maxReached", { max: MAX_CUSTOM_QUESTIONS })}</p>
      )}
    </div>
  );
}
