import { KpiDashboard } from "@/components/super/kpi-dashboard";
import { getSuperKpis } from "@/lib/platform/super-store";
import { countRecentAudit } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default async function SuperOverviewPage() {
  const [kpis, auditEvents24h] = await Promise.all([
    getSuperKpis(),
    countRecentAudit(ONE_DAY_MS),
  ]);

  return <KpiDashboard kpis={kpis} auditEvents24h={auditEvents24h} />;
}
