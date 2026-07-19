import { prisma } from "@/lib/prisma";

/**
 * Public-facing site configuration. All fields are nullable — a null value
 * means the field is hidden on the public site (e.g. a null instagramUrl
 * means no Instagram icon appears in the footer).
 */
export type SiteSettings = {
  instagramUrl: string | null;
  facebookUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  youtubeUrl: string | null;
  telegramUrl: string | null;
  contactEmail: string | null;
};

export const EMPTY_SITE_SETTINGS: SiteSettings = {
  instagramUrl: null,
  facebookUrl: null,
  twitterUrl: null,
  linkedinUrl: null,
  youtubeUrl: null,
  telegramUrl: null,
  contactEmail: null,
};

const SETTINGS_ROW_ID = "default";

function shape(row: {
  instagramUrl: string | null;
  facebookUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  youtubeUrl: string | null;
  telegramUrl: string | null;
  contactEmail: string | null;
}): SiteSettings {
  return {
    instagramUrl: row.instagramUrl,
    facebookUrl: row.facebookUrl,
    twitterUrl: row.twitterUrl,
    linkedinUrl: row.linkedinUrl,
    youtubeUrl: row.youtubeUrl,
    telegramUrl: row.telegramUrl,
    contactEmail: row.contactEmail,
  };
}

/**
 * Fetch the singleton SiteSettings row. Fails open with EMPTY_SITE_SETTINGS
 * if the table doesn't exist yet (migration not applied), the DB is
 * unavailable, or the row hasn't been created yet. The public footer must
 * keep rendering even if settings can't be loaded.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const row = await prisma.siteSettings.findUnique({
      where: { id: SETTINGS_ROW_ID },
    });
    if (!row) return EMPTY_SITE_SETTINGS;
    return shape(row);
  } catch {
    return EMPTY_SITE_SETTINGS;
  }
}

export async function updateSiteSettings(
  input: Partial<SiteSettings>,
  updatedBy: string,
): Promise<SiteSettings> {
  const row = await prisma.siteSettings.upsert({
    where: { id: SETTINGS_ROW_ID },
    create: { id: SETTINGS_ROW_ID, ...input, updatedBy },
    update: { ...input, updatedBy },
  });
  return shape(row);
}
