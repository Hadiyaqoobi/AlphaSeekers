import { ClassStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * What the public landing page advertises: classes open for enrolment, webinars
 * still to come, and opportunities still open.
 *
 * Until this existed, a new class was invisible to anyone who wasn't already
 * signed in — the class list is behind login, so a visitor arriving from a
 * poster saw no evidence the advertised class existed.
 */
export type LandingClass = {
  id: string;
  name: string;
  subjectCategory: string;
  schedulePreference: string | null;
  language: string | null;
  teacherName: string | null;
  seatsLeft: number | null;
};

export type LandingWebinar = {
  id: string;
  title: string;
  startsAt: string;
  language: string;
};

export type LandingOpportunity = {
  id: string;
  title: string;
  type: string;
  deadline: string;
  externalUrl: string;
};

export type LandingHighlights = {
  classes: LandingClass[];
  webinars: LandingWebinar[];
  opportunities: LandingOpportunity[];
};

export const EMPTY_HIGHLIGHTS: LandingHighlights = {
  classes: [],
  webinars: [],
  opportunities: [],
};

/**
 * Fails open to an empty set: the marketing page must keep rendering even if
 * the database is unreachable. An empty section is hidden entirely rather than
 * shown as a broken or "nothing here" panel.
 */
export async function getLandingHighlights(): Promise<LandingHighlights> {
  const now = new Date();

  try {
    const [classes, webinars, opportunities] = await Promise.all([
      // `published` gives admins a way to keep a class off the public page while
      // it is still being set up. It was written on every class but never
      // filtered on anywhere until now.
      prisma.class.findMany({
        where: { status: ClassStatus.ACTIVE, published: true },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          name: true,
          subjectCategory: true,
          schedulePreference: true,
          language: true,
          maxStudents: true,
          teacher: { select: { name: true } },
          _count: { select: { enrollments: true } },
        },
      }),
      prisma.webinar.findMany({
        where: { startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        take: 3,
        select: { id: true, title: true, startsAt: true, language: true },
      }),
      prisma.opportunity.findMany({
        where: { deadline: { gte: now } },
        orderBy: { deadline: "asc" },
        take: 3,
        select: { id: true, title: true, type: true, deadline: true, externalUrl: true },
      }),
    ]);

    return {
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        subjectCategory: c.subjectCategory,
        schedulePreference: c.schedulePreference,
        language: c.language,
        teacherName: c.teacher?.name ?? null,
        seatsLeft:
          typeof c.maxStudents === "number"
            ? Math.max(0, c.maxStudents - c._count.enrollments)
            : null,
      })),
      webinars: webinars.map((w) => ({
        id: w.id,
        title: w.title,
        startsAt: w.startsAt.toISOString(),
        language: w.language,
      })),
      opportunities: opportunities.map((o) => ({
        id: o.id,
        title: o.title,
        type: o.type,
        deadline: o.deadline.toISOString(),
        externalUrl: o.externalUrl,
      })),
    };
  } catch {
    return EMPTY_HIGHLIGHTS;
  }
}
