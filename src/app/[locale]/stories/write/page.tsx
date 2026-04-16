import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { PostEditor } from "@/components/stories/post-editor";
import { getSessionUser } from "@/lib/security/session";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { locale: string };
  searchParams: { edit?: string };
}

export default async function WritePage({ params, searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/${params.locale}/login?callbackUrl=/${params.locale}/stories/write`);
  }
  if (!user.approved) {
    redirect(`/${params.locale}/pending-approval`);
  }

  const isDari = params.locale === "fa";

  // Load existing post if editing
  let initialPost = null;
  if (searchParams.edit) {
    const post = await prisma.studentPost.findUnique({
      where: { id: searchParams.edit },
    });
    if (post && post.authorId === user.id) {
      initialPost = post;
    }
  }

  return (
    <main className="bg-dark-50 min-h-screen py-8 lg:py-12">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <Link
            href={`/${params.locale}/stories`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink-main font-medium"
          >
            ← {isDari ? "بازگشت به داستان‌ها" : "Back to Stories"}
          </Link>
        </div>

        <div className="bg-dark-100 rounded-2xl border border-line-DEFAULT shadow-sm p-6 lg:p-10">
          <h1 className="text-2xl font-bold text-ink-main mb-2">
            {initialPost
              ? (isDari ? "ویرایش پست" : "Edit post")
              : (isDari ? "داستان خود را بنویسید" : "Write your story")}
          </h1>
          <p className="text-sm text-ink-soft mb-8">
            {isDari
              ? "پست شما قبل از انتشار توسط تیم بررسی می‌شود."
              : "Your post will be reviewed by our team before it goes public."}
          </p>

          <PostEditor locale={params.locale} initialPost={initialPost} />
        </div>
      </div>
    </main>
  );
}
