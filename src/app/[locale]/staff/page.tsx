import { redirect } from "next/navigation";

/**
 * /[locale]/staff → redirects to /[locale]/staff/dashboard
 * The staff landing page redirects to the staff dashboard.
 */
export default async function StaffPage(props: { params: Promise<{ locale: string }> }) {
 const params = await props.params;
 redirect(`/${params.locale}/staff/dashboard`);
}
