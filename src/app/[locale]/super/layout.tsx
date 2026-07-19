import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { SuperSubnav } from "@/components/super/super-subnav";
import { getAccessControl, isSuper } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";

type SuperLayoutProps = {
  children: ReactNode;
  params: { locale: string };
};

export default async function SuperLayout({ children, params }: SuperLayoutProps) {
  const access = await getAccessControl();

  if (!access) {
    redirect(`/${params.locale}/login`);
  }
  if (!isSuper(access)) {
    redirect(`/${params.locale}/dashboard`);
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-neon-600">Internal</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">Super Admin</h1>
        <p className="mt-2 text-sm text-gray-500">
          Platform-wide oversight — staff access, audit trail, KPIs and system health.
        </p>
      </header>

      <SuperSubnav locale={params.locale} />

      <div className="mt-8">{children}</div>
    </section>
  );
}
