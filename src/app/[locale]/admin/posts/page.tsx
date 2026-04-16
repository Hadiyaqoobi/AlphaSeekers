import { redirect } from "next/navigation";

import { PostModeration } from "@/components/admin/post-moderation";
import { getSessionUser } from "@/lib/security/session";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { locale: string };
}

export default async function AdminPostsPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect(`/${params.locale}/login`);
  if (user.role !== "ADMIN") redirect(`/${params.locale}`);

  return (
    <main className="mx-auto max-w-5xl px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-main">Student Voices — Moderation</h1>
        <p className="text-sm text-ink-soft mt-1">
          Review, approve, and feature student-submitted posts.
        </p>
      </div>
      <PostModeration locale={params.locale} />
    </main>
  );
}
