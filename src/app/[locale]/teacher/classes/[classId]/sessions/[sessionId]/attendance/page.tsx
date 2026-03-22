import { redirect } from "next/navigation";

import { AttendanceSheet } from "@/components/attendance/attendance-views";
import { getSessionUser } from "@/lib/security/session";

type AttendancePageProps = {
  params: { locale: string; classId: string; sessionId: string };
};

export const dynamic = "force-dynamic";

export default async function AttendancePage({ params }: AttendancePageProps) {
  const { locale, sessionId } = params;
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  return <AttendanceSheet sessionId={sessionId} locale={locale} />;
}
