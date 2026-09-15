import { redirect } from "next/navigation";

/**
 * /[locale]/admin → redirects to /[locale]/admin/users
 * The admin landing page redirects to user management.
 */
export default async function AdminPage(props: { params: Promise<{ locale: string }> }) {
 const params = await props.params;
 redirect(`/${params.locale}/admin/users`);
}
