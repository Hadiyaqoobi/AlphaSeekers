import { redirect } from "next/navigation";

import { LearningDashboard } from "@/components/ai/learning-dashboard";
import { getSessionUser } from "@/lib/security/session";
import { loginHref } from "@/lib/ui/safe-next";

type LearningPageProps = { params: { locale: string } };

export default async function LearningPage({ params }: LearningPageProps) {
  // The dashboard's data is per-user; a signed-out visitor used to get an error
  // panel here instead of the sign-in page.
  const user = await getSessionUser();
  if (!user) redirect(loginHref(params.locale, `/${params.locale}/learning`));

  return (
    <main className="mx-auto max-w-6xl px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink-main tracking-tight">Your learning journey</h1>
        <p className="text-ink-soft mt-2">
          A view of what you&apos;ve studied, where you&apos;re growing, and what&apos;s due for review.
        </p>
      </div>
      <LearningDashboard />
    </main>
  );
}
