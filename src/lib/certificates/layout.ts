/**
 * Where the words go on Sahar's two approved certificate designs
 * (design-drafts/certificates-v3-final, blanked copies in
 * public/certificates/templates).
 *
 * Every position is in the template's own pixels, measured from the original
 * artwork, so the web page (percentages) and the downloaded image (canvas
 * pixels) draw from the same numbers. Plain data with no server imports: the
 * browser needs it too.
 */

export type CertificateKindName = "STUDENT_COMPLETION" | "TEACHER_RECOGNITION";

/** What a certificate says. Built from a stored row, never from user input on the page. */
export type CertificateContent = {
  kind: CertificateKindName;
  code: string;
  recipientName: string;
  className: string;
  teacherName: string;
  detail: string | null;
  hours: string | null;
  issuedAt: string;
};

export type TextLine = {
  text: string;
  /** Centre of the line (template px). */
  x: number;
  y: number;
  /** Font size (template px) after shrinking to fit `maxWidth`. */
  size: number;
  family: "script" | "sans" | "serif";
  weight: number;
  color: string;
  align: "center" | "left";
  maxWidth: number;
  /** Extra space between letters, in em. */
  tracking?: number;
};

export type CertificateLayout = {
  width: number;
  height: number;
  background: string;
  qr: { x: number; y: number; size: number };
  lines: TextLine[];
};

export const FONT_STACKS: Record<TextLine["family"], string> = {
  script: "'Great Vibes', cursive",
  sans: "'Montserrat', 'Helvetica Neue', Arial, sans-serif",
  serif: "'Noto Serif', Georgia, serif",
};

/** Shown under the QR code: short enough to type in by hand. */
export const VERIFY_HOST = "alphaseekers.org/verify";

/**
 * Average glyph width in em, per family. Used to shrink a long name or class
 * title so it stays inside the design instead of running into the border.
 * Deliberately a little generous: shrinking slightly too early is invisible,
 * overflowing is not.
 */
const AVG_EM: Record<TextLine["family"], number> = { script: 0.42, sans: 0.6, serif: 0.62 };

export function fitSize(text: string, base: number, maxWidth: number, family: TextLine["family"], tracking = 0): number {
  const perChar = (AVG_EM[family] + tracking) * base;
  const estimated = Math.max(1, text.length) * perChar;
  if (estimated <= maxWidth) return base;
  return Math.max(Math.round(base * 0.45), Math.floor((base * maxWidth) / estimated));
}

/** "2026/10/15" -- the format the design itself shows (Year/MM/Day). */
export function formatIssuedDate(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}`;
}

function line(partial: Omit<TextLine, "size"> & { base: number }): TextLine {
  const { base, ...rest } = partial;
  return { ...rest, size: fitSize(rest.text, base, rest.maxWidth, rest.family, rest.tracking ?? 0) };
}

/** "an 8-week", "an 11-week", "a 6-week": the article follows the sound, not the letter. */
export function withArticle(phrase: string): string {
  return /^(8|11|18|8\d|[aeiou])/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
}

/** The design's wording: "for successfully completing the [Course], a [Duration] course taught by [Instructor]." */
export function studentSentence(content: CertificateContent): [string, string] {
  const length = content.detail?.trim();
  return [
    `for successfully completing the ${content.className},`,
    length
      ? `${withArticle(length)} course taught by ${content.teacherName}.`
      : `a course taught by ${content.teacherName}.`,
  ];
}

export function teacherDetailLine(content: CertificateContent): string {
  return [content.className, content.detail?.trim(), content.hours?.trim()].filter(Boolean).join("  ·  ");
}

export function certificateLayout(content: CertificateContent): CertificateLayout {
  const date = `Date: ${formatIssuedDate(content.issuedAt)}`;

  if (content.kind === "TEACHER_RECOGNITION") {
    const small = { family: "sans" as const, weight: 500, color: "#292929", align: "center" as const, x: 707, maxWidth: 300, base: 17 };
    return {
      width: 1414,
      height: 2000,
      background: "/certificates/templates/teacher-recognition-certificate.jpg",
      qr: { x: 625, y: 1609, size: 143 },
      lines: [
        line({ text: content.recipientName, x: 707, y: 985, base: 120, family: "script", weight: 400, color: "#ab7c35", align: "center", maxWidth: 880 }),
        line({ text: teacherDetailLine(content), x: 707, y: 1199, base: 26, family: "serif", weight: 400, color: "#482f19", align: "center", maxWidth: 980, tracking: 0.08 }),
        line({ ...small, text: "Verify this certificate", y: 1780 }),
        line({ ...small, text: content.code, y: 1802 }),
        line({ ...small, text: VERIFY_HOST, y: 1826 }),
        line({ ...small, text: date, x: 218, y: 1818, align: "left", maxWidth: 250 }),
      ],
    };
  }

  const [first, second] = studentSentence(content);
  const body = { family: "sans" as const, weight: 500, color: "#09342a", align: "center" as const, x: 1000, maxWidth: 1180, base: 31 };
  const small = { family: "sans" as const, weight: 500, color: "#29292a", align: "center" as const, x: 1016, maxWidth: 340, base: 19 };
  return {
    width: 2000,
    height: 1414,
    background: "/certificates/templates/student-completion-certificate.jpg",
    qr: { x: 933, y: 1072, size: 166 },
    lines: [
      line({ text: content.recipientName, x: 1000, y: 692, base: 110, family: "script", weight: 400, color: "#006c53", align: "center", maxWidth: 1150 }),
      line({ ...body, text: first, y: 836 }),
      line({ ...body, text: second, y: 875 }),
      line({ ...small, text: date, y: 1302 }),
      line({ ...small, text: "Verify this certificate", y: 1329 }),
      line({ ...small, text: content.code, y: 1355 }),
      line({ ...small, text: VERIFY_HOST, y: 1382 }),
    ],
  };
}
