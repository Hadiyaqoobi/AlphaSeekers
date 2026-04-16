/**
 * Superadmin gate.
 *
 * The superadmin sees internal system tools (AI Health, raw interaction logs,
 * provider configs, debug pages). Other ADMINs see the normal admin dashboard
 * but NOT these internal tools.
 *
 * Add more emails to SUPERADMIN_EMAILS to grant superadmin access.
 */

const SUPERADMIN_EMAILS = [
  "hadiyaqoobi@gmail.com",
];

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPERADMIN_EMAILS.includes(email.toLowerCase());
}
