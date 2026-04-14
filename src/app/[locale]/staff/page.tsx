import { redirect } from "next/navigation";

/**
 * /[locale]/staff → redirects to /[locale]/staff/dashboard
 * The staff landing page redirects to the staff dashboard.
 */
export default function StaffPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/staff/dashboard`);
}
