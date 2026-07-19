import { AuditTable, type AuditRow } from "@/components/super/audit-table";
import { listAuditLog } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

export default async function SuperAuditPage() {
  const { items, nextCursor } = await listAuditLog({ limit: 50 });

  // Normalize Date -> ISO string so it matches the GET /api/super/audit JSON.
  const rows: AuditRow[] = items.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    actorEmail: r.actorEmail,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    details: r.details,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink-main">Audit log</h2>
        <p className="mt-0.5 text-sm text-ink-soft">
          Every privileged staff action — provisioning, access changes and deactivations.
        </p>
      </div>
      <AuditTable initial={{ items: rows, nextCursor }} />
    </div>
  );
}
