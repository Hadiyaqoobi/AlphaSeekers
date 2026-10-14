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
 * teacher hasn't connected their own calendar (or their token was revoked).
 *
 * ONLY the account named by GOOGLE_CALENDAR_OWNER_EMAIL. There used to be a second
 * fallback to "whichever account connected Google most recently", which silently
 * put every unlinked teacher's class on some other teacher's (or a student's)
 * calendar and made THEM the Meet host. With the variable unset, an unlinked
 * teacher's session gets a PENDING link that staff can fill in by hand.
 */
/**
 * The shared AlphaSeekers Google account that creates Meet links for teachers
 * who have not connected their own. GOOGLE_CALENDAR_OWNER_EMAIL may name either
 * the GOOGLE account (the calendar's owner, e.g. alphaseekers2026@gmail.com) or
 * the AlphaSeekers login that connected it.
 *
 * Only the login was matched before. Production sets the Google address, which
 * is connected under an admin's login with a different email, so the lookup
 * found nothing and every such session's Meet link stayed PENDING.
 */
export async function getPlatformCalendarLink(): Promise<GoogleAccountLink | null> {
  const email = process.env.GOOGLE_CALENDAR_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const byGoogleAccount = await prisma.googleAccountLink.findFirst({
    where: { googleEmail: { equals: email, mode: "insensitive" }, NOT: { refreshToken: "" } },
    orderBy: { updatedAt: "desc" },
  });
  if (byGoogleAccount?.refreshToken) return byGoogleAccount;
  const owner = await prisma.user.findUnique({ where: { email } });
  if (!owner) return null;
  const link = await prisma.googleAccountLink.findUnique({ where: { userId: owner.id } });
  return link?.refreshToken ? link : null;
}

/**
 * The account that OWNS an existing event. Sessions store the concrete calendar id
 * the event was created on (the account's address for a primary calendar — see
 * concreteCalendarId), so a reschedule/cancel reaches the creator's calendar even
 * after the class changed teacher or the platform account changed. Legacy rows
 * that stored the alias "primary" cannot be resolved and return null.
 */
async function findLinkForCalendar(calendarId: string | undefined): Promise<GoogleAccountLink | null> {
  const id = calendarId?.trim();
  if (!id || id === "primary") return null;
  const link = await prisma.googleAccountLink.findFirst({
    where: {
      NOT: { refreshToken: "" },
      OR: [{ calendarId: id }, { googleEmail: { equals: id, mode: "insensitive" } }],
    },
  });
  return link ?? null;
}

function buildCalendarSetup(oauthClient: GoogleOAuthClient, accountLink: GoogleAccountLink): CalendarSetupResult {
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

/** Client for the platform account only (used when the teacher's own token is revoked). */
async function getPlatformCalendarClient(): Promise<CalendarSetupResult> {
  const oauthClient = getGoogleOAuthClient();
  if (!oauthClient) return { ok: false, reason: "no-oauth" };
  const link = await getPlatformCalendarLink();
  if (!link) return { ok: false, reason: "not-linked" };
  return buildCalendarSetup(oauthClient, link);
}

/**
 * Client for an EXISTING event: the account that created it when we can tell,
 * otherwise the old teacher-then-platform lookup.
 */
async function getCalendarClientForEvent(calendarId: string | undefined, teacherId?: string): Promise<CalendarSetupResult> {
  const owner = await findLinkForCalendar(calendarId);
  if (owner) {
    const oauthClient = getGoogleOAuthClient();
    if (!oauthClient) return { ok: false, reason: "no-oauth" };
    return buildCalendarSetup(oauthClient, owner);
  }
  return getCalendarClient(teacherId);
}

/** True when Google says the stored refresh token is dead (revoked / expired). */
function isInvalidGrant(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { message?: unknown; response?: { data?: { error?: unknown } } };
  return (
    err.response?.data?.error === "invalid_grant" ||
    (typeof err.message === "string" && err.message.includes("invalid_grant"))
  );
}

/**
 * The calendar id to store on the session. "primary" is an alias that means a
 * different calendar for every account, so it cannot later tell us whose event
 * this is; the organizer address (= the account's address for a primary
 * calendar) can.
 */
function concreteCalendarId(event: calendar_v3.Schema$Event, setup: Extract<CalendarSetupResult, { ok: true }>): string {
  if (setup.calendarId !== "primary") return setup.calendarId;
  return event.organizer?.email ?? setup.accountLink.googleEmail ?? setup.calendarId;
}

async function getCalendarClient(teacherId?: string): Promise<CalendarSetupResult> {
  warnIfInsecureProductionConfig();

  const oauthClient = getGoogleOAuthClient();
  if (!oauthClient) {
    return { ok: false, reason: "no-oauth" };
  }

  // Prefer the teacher's own connected calendar; otherwise fall back to the shared
  // platform Google account (GOOGLE_CALENDAR_OWNER_EMAIL only), so a real Meet link
  // is created automatically even when the teacher has not connected Google.
  let accountLink = teacherId
    ? await prisma.googleAccountLink.findUnique({ where: { userId: teacherId } })
    : null;

  if (!accountLink?.refreshToken) {
    accountLink = await getPlatformCalendarLink();
  }

  if (!accountLink?.refreshToken) {
    return { ok: false, reason: "not-linked" };
  }

  return buildCalendarSetup(oauthClient, accountLink);
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
  const first = await getCalendarClient(input.teacherId);
  if (!first.ok) {
    return unconfiguredMeetResult(first.reason);
  }

  try {
    return await insertMeetEvent(first, input);
  } catch (error) {
    // The teacher's own token was revoked or expired (invalid_grant). Retrying
    // with the same dead token can never succeed, so use the platform account the
    // same way as for a teacher who never linked Google, instead of FAILED.
    const isPlatformAlready =
      first.accountLink.userId === (await getPlatformCalendarLink())?.userId;
    if (!isInvalidGrant(error) || isPlatformAlready) throw error;
    const platform = await getPlatformCalendarClient();
    if (!platform.ok) {
      throw new NonRetryableError("teacher Google token revoked and no platform calendar is configured");
    }
    return insertMeetEvent(platform, input);
  }
}

async function insertMeetEvent(
  setup: Extract<CalendarSetupResult, { ok: true }>,
  input: GenerateMeetInput,
): Promise<MeetGenerationResult> {
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
  const calendarId = concreteCalendarId(event, setup);

  await persistRefreshedCredentials(setup.oauthClient, setup.accountLink);

  if (!meetLink) {
    return {
      link: null,
      status: "FAILED",
      note: `Calendar event created (${eventId ?? "unknown"}) but Meet link was not returned.`,
      eventId,
      calendarId,
    };
  }

  return {
    link: meetLink,
    status: "GENERATED",
    note: `Google Calendar event created (${eventId ?? "unknown"})`,
    eventId,
    calendarId,
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
  // Patch on the calendar of the account that CREATED the event, not whoever
  // teaches the class now (the teacher may have changed, or the event may live on
  // the platform account).
  const setup = await getCalendarClientForEvent(input.calendarId, input.teacherId);
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
  // Delete from the creator's calendar (see getCalendarClientForEvent).
  const setup = await getCalendarClientForEvent(input.calendarId, input.teacherId);
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
