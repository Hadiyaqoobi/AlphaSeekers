/**
 * GET /api/classes/[id]/responses?locale=fa — the class's sign-up answers as a
 * spreadsheet (ADR-0009): one row per student in the class, one column per
 * question. Opens directly in Google Sheets (File → Import) and Excel.
 *
 * Who may download: staff with classes.view, and the class's own teacher. The
 * answers include phone numbers, so nobody else — not other teachers, not
 * students.
 */
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { displayAnswer, toCsv, type CsvCell } from "@/lib/platform/join-answers";
import { optionLabel, questionLabel, readJoinQuestions } from "@/lib/platform/join-questions";
import { listClassEnrollments } from "@/lib/platform/store";
import { prisma } from "@/lib/prisma";
import { can, getAccessControl } from "@/lib/security/permissions";
import { getSessionUser, unauthorized } from "@/lib/security/session";

type Params = { params: { id: string } };

/** "2026-10-14 18:05", Kabul: sorts correctly as text in any spreadsheet. */
function kabulStamp(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kabul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const klass = await prisma.class.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, teacherId: true, joinQuestions: true },
  });
  if (!klass) return NextResponse.json({ message: "Class not found" }, { status: 404 });

  const access = await getAccessControl();
  const isOwnTeacher = user.role === "TEACHER" && user.approved && user.id === klass.teacherId;
  if (!can(access, "classes.view") && !isOwnTeacher) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "fa";
  const t = await getTranslations({ locale, namespace: "joinQuestions" });
  const tr = (key: string) => t(key);

  const questions = readJoinQuestions(klass.joinQuestions);
  const students = await listClassEnrollments(klass.id);

  const rows: CsvCell[][] = [
    [t("csv.name"), t("csv.email"), t("csv.joined"), ...questions.map((q) => questionLabel(q, tr))],
    ...students.map((student) => [
      student.name,
      student.email,
      kabulStamp(student.enrolledAt),
      ...questions.map((q): CsvCell => {
        const answer = displayAnswer(q, student.answers[q.id], (question, option) => optionLabel(question, option, tr));
        // Shown exactly as typed: no formula, no lost leading zero, no ' prefix.
        return q.kind === "phone" && answer ? { asText: answer } : answer;
      }),
    ]),
  ];

  // An ASCII file name (any language in the class name breaks some browsers'
  // download headers); the class name is inside the file anyway.
  const fileName = `class-${klass.id}-students.csv`;
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
