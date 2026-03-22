import { randomUUID } from "crypto";

import { google } from "googleapis";

import { getGoogleOAuthClient } from "@/lib/integrations/google-auth";
import { prisma } from "@/lib/prisma";
import { runtime, warnIfInsecureProductionConfig } from "@/lib/runtime";
import { retryWithBackoff } from "@/lib/retry";

export type MeetGenerationResult = {
  link: string | null;
  status: "GENERATED" | "PENDING" | "FAILED";
  note?: string;
};

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
  };
}

function mockMeetLink(note: string): MeetGenerationResult {
  return {
    link: `https://meet.google.com/${randomCode()}`,
    status: "GENERATED",
    note,
  };
}

async function createMeetLink(input: GenerateMeetInput): Promise<MeetGenerationResult> {
  warnIfInsecureProductionConfig();

  const oauthClient = getGoogleOAuthClient();

  if (!oauthClient) {
    return runtime.allowMockMeetLinks
      ? mockMeetLink("Mock meet link generated because Google OAuth credentials are not configured.")
      : pendingMeetLink("Google OAuth credentials are not configured.");
  }

  if (!input.teacherId) {
    return runtime.allowMockMeetLinks
      ? mockMeetLink("Mock meet link generated because teacher Google account is not linked.")
      : pendingMeetLink("Teacher Google account is not linked.");
  }

  const accountLink = await prisma.googleAccountLink.findUnique({
    where: {
      userId: input.teacherId,
    },
  });

  if (!accountLink?.refreshToken) {
    return runtime.allowMockMeetLinks
      ? mockMeetLink("Mock meet link generated because teacher has not connected Google Calendar.")
      : pendingMeetLink("Teacher has not connected Google Calendar.");
  }

  oauthClient.setCredentials({
    refresh_token: accountLink.refreshToken,
    access_token: accountLink.accessToken ?? undefined,
    expiry_date: accountLink.expiryDate?.getTime(),
  });

  const start = new Date(input.startIso);
  const end = input.endIso ? new Date(input.endIso) : new Date(start.getTime() + 55 * 60 * 1000);

  const calendar = google.calendar({
    version: "v3",
    auth: oauthClient,
  });

  const response = await calendar.events.insert({
    calendarId: accountLink.calendarId ?? "primary",
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
  const meetLink =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
    null;

  const latestCredentials = oauthClient.credentials;

  await prisma.googleAccountLink.update({
    where: {
      userId: input.teacherId,
    },
    data: {
      accessToken: latestCredentials.access_token ?? accountLink.accessToken,
      scope: latestCredentials.scope ?? accountLink.scope,
      expiryDate: latestCredentials.expiry_date ? new Date(latestCredentials.expiry_date) : accountLink.expiryDate,
    },
  });

  if (!meetLink) {
    return {
      link: null,
      status: "FAILED",
      note: `Calendar event created (${event.id ?? "unknown"}) but Meet link was not returned.`,
    };
  }

  return {
    link: meetLink,
    status: "GENERATED",
    note: `Google Calendar event created (${event.id ?? "unknown"})`,
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
    };
  }
}
