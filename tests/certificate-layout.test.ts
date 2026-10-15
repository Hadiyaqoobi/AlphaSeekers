import { describe, expect, it } from "vitest";

import {
  certificateLayout,
  fitSize,
  formatIssuedDate,
  studentSentence,
  teacherDetailLine,
  withArticle,
  type CertificateContent,
} from "@/lib/certificates/layout";
import { generateCertificateCode, normalizeCertificateCode } from "@/lib/platform/certificates";

const student: CertificateContent = {
  kind: "STUDENT_COMPLETION",
  code: "AS-2026-K7QM-3XPD",
  recipientName: "Fatima Ahmadi",
  className: "Pre-intermediate English",
  teacherName: "Laura Bennett",
  detail: "8-week",
  hours: null,
  issuedAt: "2026-10-15T09:00:00.000Z",
};

describe("certificate codes", () => {
  it("look like AS-<year>-XXXX-XXXX without the look-alike letters", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateCertificateCode(new Date("2026-10-15T00:00:00Z"));
      expect(code).toMatch(/^AS-2026-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    }
  });

  it("accept a code typed by hand: any case, spaces, O for 0 and I or L for 1", () => {
    expect(normalizeCertificateCode(" as-2026-k7qm-3xpd ")).toBe("AS-2026-K7QM-3XPD");
    expect(normalizeCertificateCode("AS-2026-OOIL-3XPD")).toBe("AS-2026-0011-3XPD");
    expect(normalizeCertificateCode("AS-2026-K7QM%203XPD")).toBe("AS-2026-K7QM3XPD");
  });

  it("leave hand-made legacy IDs alone", () => {
    expect(normalizeCertificateCode("AS-TEACH-2026-HN-8F4C")).toBe("AS-TEACH-2026-HN-8F4C");
  });
});

describe("certificate wording", () => {
  it("follows the approved design's sentence", () => {
    expect(studentSentence(student)).toEqual([
      "for successfully completing the Pre-intermediate English,",
      "an 8-week course taught by Laura Bennett.",
    ]);
    expect(studentSentence({ ...student, detail: "6-week" })[1]).toBe("a 6-week course taught by Laura Bennett.");
    expect(studentSentence({ ...student, detail: null })[1]).toBe("a course taught by Laura Bennett.");
  });

  it("uses an before a vowel sound", () => {
    expect(withArticle("11-week")).toBe("an 11-week");
    expect(withArticle("12-week")).toBe("a 12-week");
    expect(withArticle("eight-week")).toBe("an eight-week");
  });

  it("drops empty teacher fields instead of printing blanks", () => {
    const teacher = { ...student, kind: "TEACHER_RECOGNITION" as const, detail: "Fall 2026", hours: null };
    expect(teacherDetailLine(teacher)).toBe("Pre-intermediate English  ·  Fall 2026");
  });

  it("prints the date the way the design shows it (Year/MM/Day)", () => {
    expect(formatIssuedDate("2026-01-05T23:00:00.000Z")).toBe("2026/01/05");
  });
});

describe("certificate layout", () => {
  it("uses the landscape design for students and the portrait one for teachers", () => {
    expect(certificateLayout(student)).toMatchObject({ width: 2000, height: 1414 });
    expect(certificateLayout({ ...student, kind: "TEACHER_RECOGNITION" })).toMatchObject({ width: 1414, height: 2000 });
  });

  it("prints the code and the verify address under the QR code", () => {
    const texts = certificateLayout(student).lines.map((line) => line.text);
    expect(texts).toContain("AS-2026-K7QM-3XPD");
    expect(texts).toContain("alphaseekers.org/verify");
    expect(texts).toContain("Date: 2026/10/15");
  });

  it("shrinks a long name so it stays inside the border", () => {
    const long = certificateLayout({ ...student, recipientName: "Mohammad Abdul Rahman Mohammadzai Sultani Karimi" });
    const name = long.lines[0];
    expect(name.size).toBeLessThan(110);
    expect(name.text.length * 0.42 * name.size).toBeLessThanOrEqual(name.maxWidth + 1);
    expect(fitSize("Ali", 110, 1150, "script")).toBe(110);
  });

  it("keeps every line inside the template", () => {
    for (const kind of ["STUDENT_COMPLETION", "TEACHER_RECOGNITION"] as const) {
      const layout = certificateLayout({ ...student, kind });
      for (const line of layout.lines) {
        expect(line.x).toBeGreaterThan(0);
        expect(line.x).toBeLessThan(layout.width);
        expect(line.y).toBeGreaterThan(0);
        expect(line.y).toBeLessThan(layout.height);
      }
      expect(layout.qr.x + layout.qr.size).toBeLessThan(layout.width);
      expect(layout.qr.y + layout.qr.size).toBeLessThan(layout.height);
    }
  });
});
