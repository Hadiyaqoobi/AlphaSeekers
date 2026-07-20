import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getSiteSettings,
  updateSiteSettings,
  type SiteSettings,
} from "@/lib/platform/site-settings";
import { forbidden, getSessionUser, unauthorized } from "@/lib/security/session";
import { AccessError, requirePermission } from "@/lib/security/permissions";

// Either an empty string ("clear this field") or a valid http(s) URL.
const urlOrEmpty = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), {
    message: "Must start with http:// or https://",
  });

const emailOrEmpty = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || z.string().email().safeParse(v).success, {
    message: "Must be a valid email address",
  });

const updateSchema = z.object({
  instagramUrl: urlOrEmpty.optional(),
  facebookUrl: urlOrEmpty.optional(),
  twitterUrl: urlOrEmpty.optional(),
  linkedinUrl: urlOrEmpty.optional(),
  youtubeUrl: urlOrEmpty.optional(),
  telegramUrl: urlOrEmpty.optional(),
  contactEmail: emailOrEmpty.optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden("Admin only");
  try {
    await requirePermission("system.settings");
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  return NextResponse.json(await getSiteSettings());
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden("Admin only");
  try {
    await requirePermission("system.settings");
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Empty string in the form means "clear the field" — store as null so the
  // public footer hides the corresponding icon.
  const cleaned: Partial<SiteSettings> = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v]),
  ) as Partial<SiteSettings>;

  const updated = await updateSiteSettings(cleaned, user.id);
  return NextResponse.json(updated);
}
