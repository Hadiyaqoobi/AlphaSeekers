import { redirect } from "next/navigation";

import { ClassAttendanceSummary } from "@/components/attendance/attendance-views";
import { getSessionUser } from "@/lib/security/session";

type ClassAttendanceSummaryPageProps = {
  params: { locale: string; classId: string };
};

export const dynamic = "force-dynamic";

export default async function ClassAttendanceSummaryPage({ params }: ClassAttendanceSummaryPageProps) {
  const { locale, classId } = params;
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  return <ClassAttendanceSummary classId={classId} locale={locale} />;
}
