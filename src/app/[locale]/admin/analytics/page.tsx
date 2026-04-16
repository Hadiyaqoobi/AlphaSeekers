import { redirect } from "next/navigation";

import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { getSessionUser } from "@/lib/security/session";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function AdminAnalyticsPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect(`/${params.locale}/login`);
  if (user.role !== "ADMIN") redirect(`/${params.locale}/dashboard`);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8" style={{ background: "#080D12" }}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#E8EEF2" }}>
          Analytics
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#8899A6" }}>
          Real platform metrics — growth, engagement, AI performance.
        </p>
      </div>
      <AnalyticsDashboard />
    </main>
  );
}
