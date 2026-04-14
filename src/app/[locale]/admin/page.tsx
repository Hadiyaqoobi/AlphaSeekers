import { redirect } from "next/navigation";

/**
 * /[locale]/admin → redirects to /[locale]/admin/users
 * The admin landing page redirects to user management.
 */
export default function AdminPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/admin/users`);
}
