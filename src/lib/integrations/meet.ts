import { randomUUID } from "crypto";

import { google, type calendar_v3 } from "googleapis";
import type { GoogleAccountLink } from "@prisma/client";

import { getGoogleOAuthClient } from "@/lib/integrations/google-auth";
import { prisma } from "@/lib/prisma";
import { runtime, warnIfInsecureProductionConfig } from "@/lib/runtime";
import { NonRetryableError, retryWithBackoff } from "@/lib/retry";
import { decryptFromRest, encryptToRest } from "@/lib/security/crypto";

export type MeetGenerationResult = {
  link: string | null;
  status: "GENERATED" | "PENDING" | "FAILED";
  note?: string;
  // The backing Google Calendar event, so a later reschedule can PATCH the same
  // event (preserving the Meet link) and a cancel can delete it. Both null when no
  // real event exists (mock / pending / unconfigured).
  eventId: string | null;
  calendarId: string | null;
};

type GoogleOAuthClient = NonNullable<ReturnType<typeof getGoogleOAuthClient>>;

/** Why an authorized calendar client could not be built. */
type CalendarSetupFailure = "no-oauth" | "no-teacher" | "not-linked";

type CalendarSetupResult =
  | {
      ok: true;
      calendar: calendar_v3.Calendar;
      calendarId: string;
      oauthClient: GoogleOAuthClient;
      accountLink: GoogleAccountLink;
    }
  | { ok: false; reason: CalendarSetupFailure };

function randomCode() {
  return `${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 6)}-${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

type GenerateMeetInput = {
  className: string;
  startIso: string;
  endIso?: string;
  teacherId?: string;
};

function pendingMeetLink(note: string): MeetGenerationResult {
  return {
    link: null,
    status: "PENDING",
    note,
    eventId: null,
    calendarId: null,
  };
}

function mockMeetLink(note: string): MeetGenerationResult {
  return {
    link: `https://meet.google.com/${randomCode()}`,
    status: "GENERATED",
    note,
    eventId: null,
    calendarId: null,
  };
}

/**
 * Build an authorized Google Calendar client for a teacher, reused by the
 * create / update / cancel event paths. Returns `ok:false` (never throws) when
 * Google OAuth is unconfigured or the teacher has not connected Calendar, so
 * callers can degrade to a mock/pending link or a best-effort no-op.
 */
/**
 * The shared "platform" Google account used to create Meet links when the class's
 * teacher hasn't connected their own calendar. This is what makes Meet-link creation
 * fully automatic: connect ONE account once and every class uses it — no per-teacher
 * step. Prefers the account named by GOOGLE_CALENDAR_OWNER_EMAIL; otherwise falls back
 * to whichever single account has been connected.
 */
async function getPlatformCalendarLink(): Promise<GoogleAccountLink | null> {
  const email = process.env.GOOGLE_CALENDAR_OWNER_EMAIL?.trim().toLowerCase();
  if (email) {
    const owner = await prisma.user.findUnique({ where: { email } });
    if (owner) {
      const link = await prisma.googleAccountLink.findUnique({ where: { userId: owner.id } });
      if (link?.refreshToken) return link;
    }
  }
  return prisma.googleAccountLink.findFirst({
    where: { NOT: { refreshToken: "" } },
    orderBy: { createdAt: "desc" },
  });
}

async function getCalendarClient(teacherId?: string): Promise<CalendarSetupResult> {
  warnIfInsecureProductionConfig();

  const oauthClient = getGoogleOAuthClient();
  if (!oauthClient) {
    return { ok: false, reason: "no-oauth" };
  }

  // Prefer the teacher's own connected calendar; otherwise fall back to the shared
  // platform Google account, so a real Meet link is created automatically even when
  // the teacher has not connected Google.
  let accountLink = teacherId
    ? await prisma.googleAccountLink.findUnique({ where: { userId: teacherId } })
    : null;

  if (!accountLink?.refreshToken) {
    accountLink = await getPlatformCalendarLink();
  }

  if (!accountLink?.refreshToken) {
    return { ok: false, reason: "not-linked" };
  }

  // Tokens are stored ENCRYPTED at rest (crypto.ts) by the OAuth callback, so they
  // must be decrypted before handing them to Google — otherwise Google receives
  // ciphertext and every calendar call fails with invalid_grant.
  oauthClient.setCredentials({
    refresh_token: decryptFromRest(accountLink.refreshToken),
    access_token: accountLink.accessToken ? decryptFromRest(accountLink.accessToken) : undefined,
    expiry_date: accountLink.expiryDate?.getTime(),
  });

  const calendar = google.calendar({
    version: "v3",
    auth: oauthClient,
  });

  return {
    ok: true,
    calendar,
    calendarId: accountLink.calendarId ?? "primary",
    oauthClient,
    accountLink,
  };
}

/** Persist any refreshed access token back to the teacher's account link. */
async function persistRefreshedCredentials(
  oauthClient: GoogleOAuthClient,
  accountLink: GoogleAccountLink,
): Promise<void> {
  const latestCredentials = oauthClient.credentials;

  await prisma.googleAccountLink.update({
    where: { userId: accountLink.userId },
    data: {
      // Re-encrypt the refreshed access token so it stays encrypted at rest (matching
      // the callback's write path); keep the prior stored value if none was refreshed.
      accessToken: latestCredentials.access_token
        ? encryptToRest(latestCredentials.access_token)
        : accountLink.accessToken,
      scope: latestCredentials.scope ?? accountLink.scope,
      expiryDate: latestCredentials.expiry_date
        ? new Date(latestCredentials.expiry_date)
        : accountLink.expiryDate,
    },
  });
}

/** Degrade a failed calendar setup to a mock (if allowed) or pending result. */
function unconfiguredMeetResult(reason: CalendarSetupFailure): MeetGenerationResult {
  const pendingNote: Record<CalendarSetupFailure, string> = {
    "no-oauth": "Google OAuth credentials are not configured.",
    "no-teacher": "Teacher Google account is not linked.",
    "not-linked": "Teacher has not connected Google Calendar.",
  };
  const mockNote: Record<CalendarSetupFailure, string> = {
    "no-oauth": "Mock meet link generated because Google OAuth credentials are not configured.",
    "no-teacher": "Mock meet link generated because teacher Google account is not linked.",
    "not-linked": "Mock meet link generated because teacher has not connected Google Calendar.",
  };

  return runtime.allowMockMeetLinks ? mockMeetLink(mockNote[reason]) : pendingMeetLink(pendingNote[reason]);
}

/** Extract the video Meet URL from a calendar event resource. */
function extractMeetLink(event: calendar_v3.Schema$Event): string | null {
  return (
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
    null
  );
}

/** True when a Google API error means the event is already gone (404 / 410). */
function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { code?: number | string; status?: number; response?: { status?: number } };
  const status =
    err.response?.status ??
    err.status ??
    (typeof err.code === "string" ? Number.parseInt(err.code, 10) : err.code);
  return status === 404 || status === 410;
}

async function createMeetLink(input: GenerateMeetInput): Promise<MeetGenerationResult> {
  const setup = await getCalendarClient(input.teacherId);
  if (!setup.ok) {
    return unconfiguredMeetResult(setup.reason);
  }

  const start = new Date(input.startIso);
  const end = input.endIso ? new Date(input.endIso) : new Date(start.getTime() + 55 * 60 * 1000);

  const response = await setup.calendar.events.insert({
    calendarId: setup.calendarId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: `${input.className} - AlphaSeekers`,
      description: "Auto-scheduled by AlphaSeekers scheduler.",
      start: {
        dateTime: start.toISOString(),
      },
      end: {
        dateTime: end.toISOString(),
      },
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
    },
  });

  const event = response.data;
  const meetLink = extractMeetLink(event);
  const eventId = event.id ?? null;

  await persistRefreshedCredentials(setup.oauthClient, setup.accountLink);

  if (!meetLink) {
    return {
      link: null,
      status: "FAILED",
      note: `Calendar event created (${eventId ?? "unknown"}) but Meet link was not returned.`,
      eventId,
      calendarId: setup.calendarId,
    };
  }

  return {
    link: meetLink,
    status: "GENERATED",
    note: `Google Calendar event created (${eventId ?? "unknown"})`,
    eventId,
    calendarId: setup.calendarId,
  };
}

export async function generateMeetLink(
  className: string,
  startIso: string,
  options?: {
    endIso?: string;
    teacherId?: string;
  },
): Promise<MeetGenerationResult> {
  try {
    return await retryWithBackoff(() =>
      createMeetLink({
        className,
        startIso,
        endIso: options?.endIso,
        teacherId: options?.teacherId,
      }),
    );
  } catch {
    return {
      link: null,
      status: "FAILED",
      note: "Meet generation failed; requires manual admin fallback.",
      eventId: null,
      calendarId: null,
    };
  }
}

async function patchMeetEvent(input: {
  eventId: string;
  calendarId?: string;
  teacherId?: string;
  className: string;
  startIso: string;
  endIso?: string;
}): Promise<MeetGenerationResult> {
  const setup = await getCalendarClient(input.teacherId);
  if (!setup.ok) {
    // We can't reach the existing event (Google unconfigured or teacher unlinked).
    // Degrade the same way a first-time link would: a mock/pending result, never a
    // second real event (createMeetLink also short-circuits on the same failure).
    const created = await createMeetLink({
      className: input.className,
      startIso: input.startIso,
      endIso: input.endIso,
      teacherId: input.teacherId,
    });
    return {
      ...created,
      note: `Could not patch existing event (${setup.reason})${created.note ? `; ${created.note}` : ""}`,
    };
  }

  const calendarId = input.calendarId ?? setup.calendarId;
  const start = new Date(input.startIso);
  const end = input.endIso ? new Date(input.endIso) : new Date(start.getTime() + 55 * 60 * 1000);

  // Patch ONLY start/end. Intentionally not resending conferenceData — patching
  // the times leaves the existing Meet conference (and its join URL) intact.
  const response = await setup.calendar.events.patch({
    calendarId,
    eventId: input.eventId,
    requestBody: {
      start: {
        dateTime: start.toISOString(),
      },
      end: {
        dateTime: end.toISOString(),
      },
    },
  });

  const event = response.data;
  const eventId = event.id ?? input.eventId;
  const meetLink = extractMeetLink(event);

  await persistRefreshedCredentials(setup.oauthClient, setup.accountLink);

  return {
    link: meetLink,
    status: "GENERATED",
    note: `Google Calendar event updated (${eventId})`,
    eventId,
    calendarId,
  };
}

/**
 * Move an existing Meet-backed calendar event to a new time by PATCHing its
 * start/end, which preserves the existing Meet link. Falls back to creating a
 * fresh link when the teacher is no longer connected / Google is unconfigured.
 * Never throws — returns a status.
 */
export async function updateMeetEvent(input: {
  eventId: string;
  calendarId?: string;
  teacherId?: string;
  className: string;
  startIso: string;
  endIso?: string;
}): Promise<MeetGenerationResult> {
  try {
    return await retryWithBackoff(() => patchMeetEvent(input));
  } catch {
    return {
      link: null,
      status: "FAILED",
      note: "Meet update failed; requires manual admin fallback.",
      eventId: input.eventId,
      calendarId: input.calendarId ?? null,
    };
  }
}

/**
 * Delete the calendar event backing a session's Meet link so the old link is no
 * longer joinable and the event is not orphaned. A 404/410 (already gone) counts
 * as success. Never throws — returns { ok }.
 */
export async function cancelMeetEvent(input: {
  eventId: string;
  calendarId?: string;
  teacherId?: string;
}): Promise<{ ok: boolean; note?: string }> {
  const setup = await getCalendarClient(input.teacherId);
  if (!setup.ok) {
    // Nothing we can delete (Google unconfigured or teacher unlinked). Treat as a
    // no-op success so cancellation is never blocked by integration state.
    return { ok: true, note: `No Google Calendar deletion performed (${setup.reason}).` };
  }

  const calendarId = input.calendarId ?? setup.calendarId;

  try {
    await retryWithBackoff(() =>
      setup.calendar.events
        .delete({
          calendarId,
          eventId: input.eventId,
        })
        .catch((error: unknown) => {
          // Already gone — deletion goal already satisfied; do not retry.
          if (isNotFoundError(error)) {
            throw new NonRetryableError("already-deleted");
          }
          throw error;
        }),
    );

    await persistRefreshedCredentials(setup.oauthClient, setup.accountLink);
    return { ok: true };
  } catch (error) {
    if (error instanceof NonRetryableError) {
      return { ok: true, note: "Calendar event was already deleted." };
    }
    return { ok: false, note: "Failed to delete Google Calendar event." };
  }
}
