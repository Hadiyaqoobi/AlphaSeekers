import { redirect } from "next/navigation";

import { JobOps, type JobOpsData } from "@/components/super/job-ops";
import { listDeadJobs, queueHealth } from "@/lib/jobs/queue";
import { getAccessControl, isSuper } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function SuperJobsPage({ params }: Props) {
  const access = await getAccessControl();
  if (!access) {
    redirect(`/${params.locale}/login`);
  }
  if (!isSuper(access)) {
    redirect(`/${params.locale}/dashboard`);
  }

  const [health, dead] = await Promise.all([queueHealth(), listDeadJobs(50)]);

  // Serialize Date -> ISO so the payload handed to the client component matches
  // the GET /api/super/jobs wire shape exactly.
  const initial: JobOpsData = {
    health,
    dead: dead.map((j) => ({
      id: j.id,
      type: j.type,
      attempts: j.attempts,
      lastError: j.lastError,
      updatedAt: j.updatedAt.toISOString(),
    })),
  };

  return <JobOps initial={initial} locale={params.locale} />;
}
