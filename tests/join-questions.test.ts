/**
 * The class's own sign-up questions (ADR-0009): what staff may save, what a
 * student's answers must look like, and the spreadsheet the team downloads.
 */
import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "@/lib/platform/join-answers";
import {
  checkAnswers,
  joinQuestionsSchema,
  readAnswers,
  readJoinQuestions,
  type JoinQuestion,
} from "@/lib/platform/join-questions";

const parse = (raw: unknown) => joinQuestionsSchema.safeParse(raw);

describe("saving questions", () => {
  it("gives a ready-made question its fixed shape, whatever the client sent", () => {
    const result = parse([
      { id: "englishLevel", kind: "englishLevel", type: "short", options: ["x"], required: true },
      { id: "phone", kind: "phone", label: "ignored" },
    ]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      {
        id: "englishLevel",
        kind: "englishLevel",
        type: "choice",
        options: ["beginner", "intermediate", "advanced"],
        required: true,
      },
      { id: "phone", kind: "phone", type: "short", required: false },
    ]);
  });

  it("keeps a ready-made question once when it is ticked twice", () => {
    const result = parse([
      { id: "age", kind: "age" },
      { id: "age", kind: "age", required: true },
    ]);
    expect(result.data).toHaveLength(1);
  });

  it("accepts up to five questions of the class's own, and no more", () => {
    const custom = (n: number) => ({ id: `q${n}`, kind: "custom", type: "short", label: `Question ${n}` });
    expect(parse([1, 2, 3, 4, 5].map(custom)).success).toBe(true);
    expect(parse([1, 2, 3, 4, 5, 6].map(custom)).success).toBe(false);
  });

  it("needs a question's text, and strips markup from it", () => {
    expect(parse([{ id: "q1", kind: "custom", label: "   " }]).success).toBe(false);
    const result = parse([{ id: "q1", kind: "custom", label: "<b>Which city?</b>" }]);
    expect(result.data?.[0].label).toBe("Which city?");
  });

  it("needs 2 to 10 distinct answers for a choice question", () => {
    expect(parse([{ id: "q1", kind: "custom", type: "choice", label: "Time?", options: ["Morning"] }]).success).toBe(false);
    const result = parse([
      { id: "q1", kind: "custom", type: "choice", label: "Time?", options: ["Morning", " Morning ", "", "Evening"] },
    ]);
    expect(result.data?.[0].options).toEqual(["Morning", "Evening"]);
  });

  it("refuses a custom question that reuses a ready-made id or another's id", () => {
    expect(parse([{ id: "phone", kind: "custom", label: "Phone?" }]).success).toBe(false);
    expect(
      parse([
        { id: "q1", kind: "custom", label: "A" },
        { id: "q1", kind: "custom", label: "B" },
      ]).success,
    ).toBe(false);
  });

  it("reads a broken stored value as no questions instead of crashing the join page", () => {
    expect(readJoinQuestions(null)).toEqual([]);
    expect(readJoinQuestions("nonsense")).toEqual([]);
    expect(readJoinQuestions([{ kind: "unknown" }])).toEqual([]);
  });
});

describe("checking a student's answers", () => {
  const questions: JoinQuestion[] = [
    { id: "phone", kind: "phone", type: "short", required: true },
    { id: "age", kind: "age", type: "short", required: false },
    { id: "englishLevel", kind: "englishLevel", type: "choice", options: ["beginner", "intermediate", "advanced"], required: false },
    { id: "q1", kind: "custom", type: "choice", label: "Time?", options: ["Morning", "Evening"], required: false },
    { id: "q2", kind: "custom", type: "paragraph", label: "Anything else?", required: false },
  ];

  it("names the first required question left empty", () => {
    expect(checkAnswers(questions, { age: "20" })).toEqual({ ok: false, questionId: "phone", reason: "required" });
    expect(checkAnswers(questions, undefined)).toEqual({ ok: false, questionId: "phone", reason: "required" });
  });

  it("turns Dari digits into 0-9 so the team can dial and sort them", () => {
    const result = checkAnswers(questions, { phone: "+۹۳ ۷۰۰ ۱۲۳ ۴۵۶", age: "۱۸" });
    expect(result).toEqual({ ok: true, answers: { phone: "+93 700 123 456", age: "18" } });
  });

  it("refuses a phone without enough digits and an age that is not a number", () => {
    expect(checkAnswers(questions, { phone: "call me" })).toMatchObject({ ok: false, questionId: "phone", reason: "invalid" });
    expect(checkAnswers(questions, { phone: "0700123456", age: "twenty" })).toMatchObject({
      ok: false,
      questionId: "age",
      reason: "invalid",
    });
  });

  it("only accepts one of the offered choices", () => {
    expect(checkAnswers(questions, { phone: "0700123456", englishLevel: "fluent" })).toMatchObject({
      ok: false,
      questionId: "englishLevel",
    });
    expect(checkAnswers(questions, { phone: "0700123456", englishLevel: "beginner", q1: "Evening" })).toEqual({
      ok: true,
      answers: { phone: "0700123456", englishLevel: "beginner", q1: "Evening" },
    });
  });

  it("drops answers to questions the class does not ask, and caps paragraph length", () => {
    expect(checkAnswers(questions, { phone: "0700123456", sneaky: "x" })).toEqual({
      ok: true,
      answers: { phone: "0700123456" },
    });
    expect(checkAnswers(questions, { phone: "0700123456", q2: "a".repeat(2001) })).toMatchObject({
      ok: false,
      questionId: "q2",
    });
  });

  it("a class with no questions accepts no answers and asks for none", () => {
    expect(checkAnswers([], { phone: "x" })).toEqual({ ok: true, answers: {} });
  });

  it("reads stored answers defensively", () => {
    expect(readAnswers({ phone: "1", age: 5 })).toEqual({ phone: "1" });
    expect(readAnswers(["x"])).toEqual({});
  });
});

describe("the spreadsheet", () => {
  it("starts with a byte-order mark so Dari opens correctly in Excel", () => {
    expect(toCsv([["نام"]]).startsWith("﻿")).toBe(true);
  });

  it("quotes every cell and doubles quotes inside", () => {
    expect(csvCell('He said "hi", then left')).toBe('"He said ""hi"", then left"');
  });

  it("never lets an answer run as a spreadsheet formula", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("+93 700")).toBe("\"'+93 700\"");
    expect(csvCell("@cmd")).toBe("\"'@cmd\"");
  });
});
