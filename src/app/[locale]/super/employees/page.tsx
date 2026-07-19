import { EmployeeManager, type EmployeeRow } from "@/components/super/employee-manager";
import { listEmployees } from "@/lib/platform/super-store";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function SuperEmployeesPage({ params }: Props) {
  const employees = await listEmployees();

  // Normalize Date -> ISO string so the client prop matches the JSON that the
  // GET /api/super/employees endpoint returns after mutations.
  const initialEmployees: EmployeeRow[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    accessLevel: e.accessLevel,
    permissions: e.permissions,
    deactivated: e.deactivated,
    createdAt: e.createdAt.toISOString(),
    createdById: e.createdById,
  }));

  return <EmployeeManager initialEmployees={initialEmployees} locale={params.locale} />;
}
