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

export const CERTIFICATE_LAYOUT_V2 = 2;
export const CURRENT_CERTIFICATE_LAYOUT_VERSION = CERTIFICATE_LAYOUT_V2;

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
  /** Stored at issuance so past certificates keep their printed design. */
  layoutVersion?: number;
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
  const updated = content.layoutVersion === CERTIFICATE_LAYOUT_V2;

  if (content.kind === "TEACHER_RECOGNITION") {
    const small = { family: "sans" as const, weight: 500, color: "#292929", align: "center" as const, x: 707, maxWidth: 300, base: 17 };
    return {
      width: 1414,
      height: 2000,
      background: updated
        ? "/certificates/templates/teacher-recognition-certificate-v2.jpg"
        : "/certificates/templates/teacher-recognition-certificate.jpg",
      qr: { x: updated ? 635 : 625, y: 1609, size: 143 },
      lines: [
        line({ text: content.recipientName, x: 707, y: updated ? 1016 : 985, base: updated ? 112 : 120, family: "script", weight: 400, color: "#ab7c35", align: "center", maxWidth: 880 }),
        line({ text: teacherDetailLine(content), x: 707, y: 1199, base: 26, family: "serif", weight: 400, color: "#482f19", align: "center", maxWidth: 980, tracking: 0.08 }),
        line({ ...small, text: "Verify this certificate", y: updated ? 1768 : 1780 }),
        line({ ...small, text: content.code, y: updated ? 1790 : 1802 }),
        line({ ...small, text: VERIFY_HOST, y: updated ? 1814 : 1826 }),
        line({ ...small, text: date, x: 218, y: updated ? 1800 : 1818, align: "left", maxWidth: 250 }),
      ],
    };
  }

  const [first, second] = studentSentence(content);
  const body = { family: "sans" as const, weight: 500, color: "#09342a", align: "center" as const, x: 1000, maxWidth: 1180, base: 31 };
  const small = { family: "sans" as const, weight: 500, color: "#29292a", align: "center" as const, x: updated ? 1000 : 1016, maxWidth: 340, base: 19 };
  return {
    width: 2000,
    height: 1414,
    background: updated
      ? "/certificates/templates/student-completion-certificate-v2.jpg"
      : "/certificates/templates/student-completion-certificate.jpg",
    qr: updated ? { x: 917, y: 1200, size: 166 } : { x: 933, y: 1072, size: 166 },
    lines: [
      line({ text: content.recipientName, x: 1000, y: updated ? 744 : 692, base: 110, family: "script", weight: 400, color: "#006c53", align: "center", maxWidth: 1150 }),
      line({ ...body, text: first, y: updated ? 863 : 836 }),
      line({ ...body, text: second, y: updated ? 903 : 875 }),
      line({ ...small, text: date, y: updated ? 1109 : 1302 }),
      line({ ...small, text: "Verify this certificate", y: updated ? 1133 : 1329 }),
      line({ ...small, text: content.code, y: updated ? 1157 : 1355 }),
      line({ ...small, text: VERIFY_HOST, y: updated ? 1181 : 1382 }),
    ],
  };
}
